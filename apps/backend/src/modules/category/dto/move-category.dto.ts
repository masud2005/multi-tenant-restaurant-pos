import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty } from 'class-validator';

export class MoveCategoryDto {
  @ApiProperty({
    description: 'Direction to move: -1 for up, 1 for down',
    example: -1,
    enum: [-1, 1],
  })
  @IsInt({ message: 'dir must be an integer' })
  @IsIn([-1, 1], { message: 'dir must be either -1 (up) or 1 (down)' })
  @IsNotEmpty({ message: 'dir is required' })
  dir: -1 | 1;
}

