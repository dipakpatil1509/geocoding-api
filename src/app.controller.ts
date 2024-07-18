import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get("/get_geocoding")
  getGeocoding(@Query('text_input') text_input: string): any {
    return this.appService.getGeocoding(text_input);
  }
}
