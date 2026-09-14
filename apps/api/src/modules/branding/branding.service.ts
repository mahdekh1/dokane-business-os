import { Injectable } from '@nestjs/common';
import type { BrandingDto, UpdateBrandingInput } from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULTS = {
  primaryColor: '#0E6A57',
  secondaryColor: '#D98E4B',
  fontHeading: 'Fraunces',
  fontBody: 'Hanken Grotesk',
  logoUrl: null as string | null,
};

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(businessId: string): Promise<BrandingDto> {
    const row = await this.prisma.branding.findUnique({ where: { businessId } });
    if (!row) return { ...DEFAULTS };
    return {
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      fontHeading: row.fontHeading,
      fontBody: row.fontBody,
      logoUrl: row.logoUrl,
    };
  }

  async update(businessId: string, input: UpdateBrandingInput): Promise<BrandingDto> {
    const data = {
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      fontHeading: input.fontHeading,
      fontBody: input.fontBody,
      logoUrl: input.logoUrl ? input.logoUrl : null,
    };
    const row = await this.prisma.branding.upsert({
      where: { businessId },
      create: { businessId, ...data },
      update: data,
    });
    return {
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      fontHeading: row.fontHeading,
      fontBody: row.fontBody,
      logoUrl: row.logoUrl,
    };
  }
}
