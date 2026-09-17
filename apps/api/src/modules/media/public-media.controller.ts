import { Controller, Get, Param } from '@nestjs/common';
import { Res } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { MediaService } from './media.service';

/** Minimal response shape (avoids an @types/express dependency). */
interface HttpResponseLike {
  status(code: number): HttpResponseLike;
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

@Controller('public/media')
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get('*')
  async serve(@Param('0') key: string, @Res() res: HttpResponseLike): Promise<void> {
    const media = await this.media.serve(key);
    if (!media) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', media.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(media.buffer);
  }
}
