import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [CouponsController], providers: [CouponsService] })
export class CouponsModule {}
