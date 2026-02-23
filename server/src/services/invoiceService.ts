import PDFDocument from 'pdfkit';
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

export interface InvoiceData {
  paymentId: string;
  tenantId: string;
}

export const invoiceService = {
  async generatePDF(tenantId: string, paymentId: string): Promise<Buffer> {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: {
        tenant: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!payment) {
      throw createError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    const invoiceNumber = payment.invoiceNumber || `INV-${payment.id.slice(0, 8).toUpperCase()}`;

    // Update invoiceNumber if not set
    if (!payment.invoiceNumber) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { invoiceNumber },
      });
    }

    const plan = payment.subscription?.plan;
    const tenant = payment.tenant;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('VYD Engage', 50, 50);
      doc.fontSize(10).font('Helvetica').text('CRM & Automation Platform', 50, 78);
      doc.moveDown(0.5);

      // Invoice title
      doc.fontSize(18).font('Helvetica-Bold').text('FATURA', 400, 50, { align: 'right' });
      doc.fontSize(10).font('Helvetica').text(invoiceNumber, 400, 74, { align: 'right' });

      // Divider
      doc.moveTo(50, 110).lineTo(545, 110).stroke('#e5e7eb');

      // Billing info
      const infoY = 130;
      doc.fontSize(10).font('Helvetica-Bold').text('Faturado para:', 50, infoY);
      doc.font('Helvetica').text(tenant.name, 50, infoY + 16);
      doc.text(`ID: ${tenant.id.slice(0, 8)}`, 50, infoY + 32);

      doc.font('Helvetica-Bold').text('Data:', 350, infoY);
      doc.font('Helvetica').text(
        (payment.paidAt || payment.createdAt).toLocaleDateString('pt-BR'),
        350, infoY + 16
      );
      doc.font('Helvetica-Bold').text('Status:', 350, infoY + 36);
      const statusLabel = payment.status === 'PAID' ? 'Pago' :
        payment.status === 'PENDING' ? 'Pendente' :
        payment.status === 'REFUNDED' ? 'Reembolsado' : payment.status;
      doc.font('Helvetica').text(statusLabel, 350, infoY + 52);

      // Table header
      const tableY = infoY + 85;
      doc.rect(50, tableY, 495, 25).fill('#f3f4f6');
      doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold');
      doc.text('Descrição', 60, tableY + 7);
      doc.text('Período', 300, tableY + 7);
      doc.text('Valor', 460, tableY + 7, { align: 'right', width: 75 });

      // Table row
      const rowY = tableY + 30;
      doc.font('Helvetica').fillColor('#374151').fontSize(10);
      const planName = plan?.name || 'Plano';
      const cycle = payment.subscription?.billingCycle === 'YEARLY' ? 'Anual' : 'Mensal';
      doc.text(`${planName} - Assinatura ${cycle}`, 60, rowY);

      const startDate = payment.subscription?.startDate || payment.createdAt;
      const periodText = `${startDate.toLocaleDateString('pt-BR')}`;
      doc.text(periodText, 300, rowY);

      const amount = Number(payment.amount);
      doc.text(`R$ ${amount.toFixed(2).replace('.', ',')}`, 460, rowY, { align: 'right', width: 75 });

      // Divider before total
      const totalDividerY = rowY + 30;
      doc.moveTo(350, totalDividerY).lineTo(545, totalDividerY).stroke('#e5e7eb');

      // Total
      const totalY = totalDividerY + 10;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827');
      doc.text('Total:', 350, totalY);
      doc.text(`R$ ${amount.toFixed(2).replace('.', ',')}`, 460, totalY, { align: 'right', width: 75 });

      // Payment method
      const methodY = totalY + 40;
      doc.fontSize(10).font('Helvetica-Bold').text('Método de Pagamento:', 50, methodY);
      const methodMap: Record<string, string> = {
        CREDIT_CARD: 'Cartão de Crédito',
        DEBIT_CARD: 'Cartão de Débito',
        PIX: 'PIX',
        BOLETO: 'Boleto',
      };
      doc.font('Helvetica').text(methodMap[payment.method] || payment.method, 200, methodY);

      // Footer
      const footerY = 750;
      doc.moveTo(50, footerY).lineTo(545, footerY).stroke('#e5e7eb');
      doc.fontSize(8).fillColor('#9ca3af').font('Helvetica');
      doc.text('VYD Engage - Parte do ecossistema VYD (Value Your Day)', 50, footerY + 10, { align: 'center', width: 495 });
      doc.text('Este documento é uma fatura gerada automaticamente.', 50, footerY + 22, { align: 'center', width: 495 });

      doc.end();
    });
  },
};
