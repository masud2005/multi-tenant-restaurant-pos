import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderCategoriesDto {
  @ApiProperty({
    description: 'List of category IDs in their desired display order',
    example: ['cat-uuid-1', 'cat-uuid-2', 'cat-uuid-3'],
    type: [String],
  })
  @IsArray({ message: 'categoryIds must be an array' })
  @ArrayNotEmpty({ message: 'categoryIds must not be empty' })
  @IsString({ each: true, message: 'Each categoryId must be a string' })
  categoryIds: string[];
}

