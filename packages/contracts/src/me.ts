import { z } from 'zod';

export const MeBusiness = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  role: z.string(),
  membershipId: z.string(),
});
export type MeBusiness = z.infer<typeof MeBusiness>;

export const MeResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().nullable(),
    language: z.string(),
    isPlatformAdmin: z.boolean(),
  }),
  businesses: z.array(MeBusiness),
});
export type MeResponse = z.infer<typeof MeResponse>;

/** Languages a user can pick for the console (wired to i18n in a later phase). */
export const UserLanguageEnum = z.enum(['en', 'ar', 'he']);
export type UserLanguage = z.infer<typeof UserLanguageEnum>;

export const UPDATE_PROFILE_LANGUAGES: { value: UserLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'he', label: 'עברית' },
];

/** Editable profile fields (email is read-only in this phase). */
export const UpdateProfileInput = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().max(40).optional().or(z.literal('')),
  language: UserLanguageEnum,
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;
