import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';

@Module({
  controllers: [BusinessesController],
})
export class BusinessesModule {}
