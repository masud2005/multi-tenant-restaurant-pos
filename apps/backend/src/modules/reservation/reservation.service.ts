import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateReservationDto,
  GetReservationsQueryDto,
  UpdateReservationDto,
  UpdateReservationSettingsDto,
  UpdateReservationStatusDto,
} from './dto';
import {
  OrderStatus,
  Prisma,
  ReservationStatus,
  TableStatus,
} from '../../../prisma/generated/client';
import {
  NotFoundException,
  ConflictException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new table reservation with seating capacity and time clash detection
   */
  async createReservation(tenantSlug: string, dto: CreateReservationDto) {
    // 1. Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Verify branch exists, is active, and belongs to tenant
    let branch = null;
    if (dto.branchId) {
      branch = await this.prisma.branch.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
          OR: [{ id: dto.branchId }, { name: dto.branchId }],
        },
      });
    }
    if (!branch) {
      branch = await this.prisma.branch.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
        },
      });
    }

    if (!branch) {
      throw new NotFoundException('Branch');
    }

    // 3. Validate customer name
    const customerName = dto.customerName?.trim();
    if (!customerName) {
      throw new BadRequestException('Guest name is required.');
    }

    // 4. Validate reservation date & time
    const bookingDate = new Date(dto.at);
    if (isNaN(bookingDate.getTime())) {
      throw new BadRequestException(
        'Valid reservation date and time is required.',
      );
    }

    const partySize = dto.partySize ?? 2;
    const durationMin = dto.durationMin ?? 90;

    let assignedTable: { id: string; name: string; seats: number } | null =
      null;

    // 5. If tableId is specified, validate table, capacity, and check collision
    const normalizedTableId =
      dto.tableId && dto.tableId !== 'none' ? dto.tableId : null;

    if (normalizedTableId) {
      const table = await this.prisma.diningTable.findFirst({
        where: {
          tenantId: tenant.id,
          isDeleted: false,
          OR: [{ id: normalizedTableId }, { name: normalizedTableId }],
        },
      });

      if (!table) {
        throw new NotFoundException('Dining table in this branch');
      }

      // Check capacity
      if (table.seats < partySize) {
        throw new BadRequestException(
          `${table.name} seats only ${table.seats}.`,
        );
      }

      // Check for time collisions against active reservations (BOOKED or SEATED)
      const reqStart = bookingDate.getTime();
      const reqEnd = reqStart + durationMin * 60000;

      // Query active bookings for this table around the window (lookback 8h, lookahead to reqEnd)
      const maxLookbackMs = 8 * 60 * 60 * 1000;
      const candidates = await this.prisma.reservation.findMany({
        where: {
          tenantId: tenant.id,
          tableId: table.id,
          isDeleted: false,
          status: {
            in: [ReservationStatus.BOOKED, ReservationStatus.SEATED],
          },
          at: {
            gte: new Date(reqStart - maxLookbackMs),
            lte: new Date(reqEnd),
          },
        },
      });

      for (const existing of candidates) {
        const existStart = existing.at.getTime();
        const existEnd = existStart + existing.durationMin * 60000;

        // Collision formula: reqStart < existEnd && existStart < reqEnd
        if (reqStart < existEnd && existStart < reqEnd) {
          throw new ConflictException(
            `${table.name} is already booked for ${existing.customerName} at that time.`,
          );
        }
      }

      assignedTable = table;
    }

    // 6. Save reservation to database
    const reservation = await this.prisma.reservation.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        customerName,
        phone: dto.phone?.trim() ?? '',
        partySize,
        at: bookingDate,
        durationMin,
        tableId: assignedTable ? assignedTable.id : null,
        tableName: assignedTable ? assignedTable.name : null,
        status: ReservationStatus.BOOKED,
        notes: dto.notes?.trim() ?? '',
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            seats: true,
            area: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return reservation;
  }

  /**
   * Get all reservations for a restaurant with branch, status, table, and date filtering
   */
  async getReservations(tenantSlug: string, query: GetReservationsQueryDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const where: Prisma.ReservationWhereInput = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [{ id: query.branchId }, { name: query.branchId }],
        },
      });
      where.branchId = branch ? branch.id : query.branchId;
    }

    if (query.tableId) {
      const table = await this.prisma.diningTable.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [{ id: query.tableId }, { name: query.tableId }],
        },
      });
      where.tableId = table ? table.id : query.tableId;
    }

    if (query.status) {
      const statusLower = query.status.toLowerCase();
      if (statusLower === 'active') {
        where.status = {
          in: [ReservationStatus.BOOKED, ReservationStatus.SEATED],
        };
      } else {
        const enumKey = query.status.toUpperCase() as ReservationStatus;
        if (Object.values(ReservationStatus).includes(enumKey)) {
          where.status = enumKey;
        }
      }
    }

    if (query.startDate || query.endDate) {
      where.at = {};
      if (query.startDate) {
        where.at.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.at.lte = new Date(query.endDate);
      }
    }

    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { customerName: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.reservation.findMany({
      where,
      orderBy: {
        at: 'asc',
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            seats: true,
            area: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get details of a single reservation
   */
  async getReservationById(tenantSlug: string, reservationId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            seats: true,
            area: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation');
    }

    return reservation;
  }

  /**
   * Get reservation settings for a tenant, initializing with defaults if not present
   */
  async getReservationSettings(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    let settings = await this.prisma.reservationSettings.findUnique({
      where: { tenantId: tenant.id },
    });

    if (!settings) {
      settings = await this.prisma.reservationSettings.create({
        data: {
          tenantId: tenant.id,
        },
      });
    }

    return settings;
  }

  /**
   * Update reservation policy settings (Owner/Manager only)
   */
  async updateReservationSettings(
    tenantSlug: string,
    dto: UpdateReservationSettingsDto,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // Logical validation if min and max party size are both provided
    if (
      dto.minPartySize !== undefined &&
      dto.maxPartySize !== undefined &&
      dto.minPartySize > dto.maxPartySize
    ) {
      throw new BadRequestException(
        'Minimum party size cannot be greater than maximum party size',
      );
    }

    const settings = await this.prisma.reservationSettings.upsert({
      where: { tenantId: tenant.id },
      update: {
        ...(dto.defaultDurationMin !== undefined && {
          defaultDurationMin: dto.defaultDurationMin,
        }),
        ...(dto.bufferTimeMin !== undefined && {
          bufferTimeMin: dto.bufferTimeMin,
        }),
        ...(dto.earlyArrivalWindowMin !== undefined && {
          earlyArrivalWindowMin: dto.earlyArrivalWindowMin,
        }),
        ...(dto.noShowGracePeriodMin !== undefined && {
          noShowGracePeriodMin: dto.noShowGracePeriodMin,
        }),
        ...(dto.minPartySize !== undefined && {
          minPartySize: dto.minPartySize,
        }),
        ...(dto.maxPartySize !== undefined && {
          maxPartySize: dto.maxPartySize,
        }),
        ...(dto.maxAdvanceDays !== undefined && {
          maxAdvanceDays: dto.maxAdvanceDays,
        }),
        ...(dto.minAdvanceHours !== undefined && {
          minAdvanceHours: dto.minAdvanceHours,
        }),
      },
      create: {
        tenantId: tenant.id,
        ...(dto.defaultDurationMin !== undefined && {
          defaultDurationMin: dto.defaultDurationMin,
        }),
        ...(dto.bufferTimeMin !== undefined && {
          bufferTimeMin: dto.bufferTimeMin,
        }),
        ...(dto.earlyArrivalWindowMin !== undefined && {
          earlyArrivalWindowMin: dto.earlyArrivalWindowMin,
        }),
        ...(dto.noShowGracePeriodMin !== undefined && {
          noShowGracePeriodMin: dto.noShowGracePeriodMin,
        }),
        ...(dto.minPartySize !== undefined && {
          minPartySize: dto.minPartySize,
        }),
        ...(dto.maxPartySize !== undefined && {
          maxPartySize: dto.maxPartySize,
        }),
        ...(dto.maxAdvanceDays !== undefined && {
          maxAdvanceDays: dto.maxAdvanceDays,
        }),
        ...(dto.minAdvanceHours !== undefined && {
          minAdvanceHours: dto.minAdvanceHours,
        }),
      },
    });

    return settings;
  }

  /**
   * Update reservation status (Seat, Complete, Cancel, No-Show) and synchronize table status
   */
  async updateReservationStatus(
    tenantSlug: string,
    reservationId: string,
    dto: UpdateReservationStatusDto,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        table: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation');
    }

    const currentStatus = reservation.status;
    const newStatus = dto.status;

    // Validate lifecycle transitions
    const allowedTransitions: Record<ReservationStatus, ReservationStatus[]> = {
      [ReservationStatus.BOOKED]: [
        ReservationStatus.SEATED,
        ReservationStatus.CANCELLED,
        ReservationStatus.NO_SHOW,
      ],
      [ReservationStatus.SEATED]: [ReservationStatus.COMPLETED],
      [ReservationStatus.COMPLETED]: [],
      [ReservationStatus.CANCELLED]: [],
      [ReservationStatus.NO_SHOW]: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition reservation status from ${currentStatus} to ${newStatus}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let targetTableId = dto.tableId ?? reservation.tableId;
      let targetTableName = reservation.tableName;

      // If a new table is being assigned or table is being switched
      if (dto.tableId && dto.tableId !== reservation.tableId) {
        const newTable = await tx.diningTable.findFirst({
          where: {
            id: dto.tableId,
            tenantId: tenant.id,
            branchId: reservation.branchId,
            isDeleted: false,
          },
        });

        if (!newTable) {
          throw new NotFoundException('Dining table in this branch');
        }

        if (newTable.seats < reservation.partySize) {
          throw new BadRequestException(
            `${newTable.name} seats only ${newTable.seats} (party size is ${reservation.partySize}).`,
          );
        }

        targetTableId = newTable.id;
        targetTableName = newTable.name;

        // If previous table was occupied/reserved by this reservation, release it
        if (reservation.tableId) {
          await tx.diningTable.update({
            where: { id: reservation.tableId },
            data: { status: TableStatus.AVAILABLE },
          });
        }
      }

      // Synchronize dining table status
      if (targetTableId) {
        if (newStatus === ReservationStatus.SEATED) {
          await tx.diningTable.update({
            where: { id: targetTableId },
            data: { status: TableStatus.OCCUPIED },
          });
        } else if (
          newStatus === ReservationStatus.COMPLETED ||
          newStatus === ReservationStatus.CANCELLED ||
          newStatus === ReservationStatus.NO_SHOW
        ) {
          // If no active orders currently running on this table, set to AVAILABLE
          const activeOrder = await tx.order.findFirst({
            where: {
              tableId: targetTableId,
              tenantId: tenant.id,
              status: {
                in: [
                  OrderStatus.IN_KITCHEN,
                  OrderStatus.READY,
                  OrderStatus.SERVED,
                ],
              },
            },
          });

          if (!activeOrder) {
            await tx.diningTable.update({
              where: { id: targetTableId },
              data: { status: TableStatus.AVAILABLE },
            });
          }
        }
      }

      // Update reservation record
      const updatedReservation = await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: newStatus,
          tableId: targetTableId,
          tableName: targetTableName,
        },
        include: {
          table: {
            select: {
              id: true,
              name: true,
              seats: true,
              area: true,
              status: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return updatedReservation;
    });
  }

  /**
   * Update details of an existing reservation
   */
  async updateReservation(
    tenantSlug: string,
    reservationId: string,
    dto: UpdateReservationDto,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation');
    }

    if (reservation.status !== ReservationStatus.BOOKED) {
      throw new ConflictException('Only booked reservations can be edited.');
    }

    let targetBranchId = reservation.branchId;
    if (dto.branchId && dto.branchId !== reservation.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
          OR: [{ id: dto.branchId }, { name: dto.branchId }],
        },
      });
      if (!branch) {
        throw new NotFoundException('Branch');
      }
      targetBranchId = branch.id;
    }

    const customerName = dto.customerName?.trim() ?? reservation.customerName;
    const phone = dto.phone !== undefined ? dto.phone.trim() : reservation.phone;
    const partySize = dto.partySize ?? reservation.partySize;
    const durationMin = dto.durationMin ?? reservation.durationMin;
    const bookingDate = dto.at ? new Date(dto.at) : reservation.at;
    const notes = dto.notes !== undefined ? dto.notes.trim() : reservation.notes;

    let assignedTableId = reservation.tableId;
    let assignedTableName = reservation.tableName;

    if (dto.tableId !== undefined) {
      const normalizedTableId =
        dto.tableId && dto.tableId !== 'none' ? dto.tableId : null;

      if (normalizedTableId) {
        const table = await this.prisma.diningTable.findFirst({
          where: {
            tenantId: tenant.id,
            isDeleted: false,
            OR: [{ id: normalizedTableId }, { name: normalizedTableId }],
          },
        });

        if (!table) {
          throw new NotFoundException('Dining table in this restaurant');
        }

        if (table.seats < partySize) {
          throw new BadRequestException(
            `${table.name} seats only ${table.seats}.`,
          );
        }

        // Collision check
        const reqStart = bookingDate.getTime();
        const reqEnd = reqStart + durationMin * 60000;
        const maxLookbackMs = 8 * 60 * 60 * 1000;

        const candidates = await this.prisma.reservation.findMany({
          where: {
            tenantId: tenant.id,
            tableId: table.id,
            isDeleted: false,
            id: { not: reservation.id },
            status: {
              in: [ReservationStatus.BOOKED, ReservationStatus.SEATED],
            },
            at: {
              gte: new Date(reqStart - maxLookbackMs),
              lte: new Date(reqEnd),
            },
          },
        });

        for (const existing of candidates) {
          const existStart = existing.at.getTime();
          const existEnd = existStart + existing.durationMin * 60000;
          if (reqStart < existEnd && existStart < reqEnd) {
            throw new ConflictException(
              `${table.name} is already booked for ${existing.customerName} at that time.`,
            );
          }
        }

        assignedTableId = table.id;
        assignedTableName = table.name;
      } else {
        assignedTableId = null;
        assignedTableName = null;
      }
    } else if (assignedTableId && (dto.at || dto.durationMin || dto.partySize)) {
      // Table was not changed, but timing or party size changed: check capacity & collision on existing table
      const table = await this.prisma.diningTable.findFirst({
        where: {
          id: assignedTableId,
          tenantId: tenant.id,
          isDeleted: false,
        },
      });

      if (table) {
        if (table.seats < partySize) {
          throw new BadRequestException(
            `${table.name} seats only ${table.seats}.`,
          );
        }

        const reqStart = bookingDate.getTime();
        const reqEnd = reqStart + durationMin * 60000;
        const maxLookbackMs = 8 * 60 * 60 * 1000;

        const candidates = await this.prisma.reservation.findMany({
          where: {
            tenantId: tenant.id,
            tableId: table.id,
            isDeleted: false,
            id: { not: reservation.id },
            status: {
              in: [ReservationStatus.BOOKED, ReservationStatus.SEATED],
            },
            at: {
              gte: new Date(reqStart - maxLookbackMs),
              lte: new Date(reqEnd),
            },
          },
        });

        for (const existing of candidates) {
          const existStart = existing.at.getTime();
          const existEnd = existStart + existing.durationMin * 60000;
          if (reqStart < existEnd && existStart < reqEnd) {
            throw new ConflictException(
              `${table.name} is already booked for ${existing.customerName} at that time.`,
            );
          }
        }
      }
    }

    return this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        customerName,
        phone,
        partySize,
        at: bookingDate,
        durationMin,
        branchId: targetBranchId,
        tableId: assignedTableId,
        tableName: assignedTableName,
        notes,
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            seats: true,
            area: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a reservation (sets isDeleted: true, deletedAt: now)
   */
  async deleteReservation(tenantSlug: string, reservationId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: reservationId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation');
    }

    if (reservation.status === ReservationStatus.SEATED) {
      throw new ConflictException(
        'Cannot delete a reservation that is currently seated. Please complete or cancel the dining session first.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // If reservation had an assigned table, check if we need to release table status
      if (reservation.tableId) {
        const table = await tx.diningTable.findFirst({
          where: {
            id: reservation.tableId,
            tenantId: tenant.id,
            isDeleted: false,
          },
        });

        if (table && table.status === TableStatus.RESERVED) {
          // Check if there are other active reservations holding this table
          const otherActive = await tx.reservation.findFirst({
            where: {
              tenantId: tenant.id,
              tableId: table.id,
              id: { not: reservation.id },
              isDeleted: false,
              status: ReservationStatus.BOOKED,
            },
          });

          if (!otherActive) {
            await tx.diningTable.update({
              where: { id: table.id },
              data: { status: TableStatus.AVAILABLE },
            });
          }
        }
      }

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Reservation deleted successfully',
      };
    });
  }
}
