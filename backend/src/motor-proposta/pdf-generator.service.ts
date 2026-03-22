import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  async gerarPdf(html: string, nomeArquivo: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfPath = path.join(os.tmpdir(), nomeArquivo);
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      this.logger.log(`PDF gerado: ${pdfPath}`);
      return pdfPath;
    } finally {
      await browser.close();
    }
  }
}
