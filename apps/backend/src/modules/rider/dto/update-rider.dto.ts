import { PartialType } from '@nestjs/swagger';
import { CreateRiderDto } from './create-rider.dto';

export class UpdateRiderDto extends PartialType(CreateRiderDto) {}

