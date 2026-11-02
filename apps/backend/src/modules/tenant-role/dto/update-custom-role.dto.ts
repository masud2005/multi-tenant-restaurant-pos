import { PartialType } from '@nestjs/swagger';
import { CreateCustomRoleDto } from './create-custom-role.dto';

export class UpdateCustomRoleDto extends PartialType(CreateCustomRoleDto) {}

