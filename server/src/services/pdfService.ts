import { generate } from '@pdfme/generator';
import type { Template } from '@pdfme/common';
import prisma from '../config/database.js';

const FONT_URL = 'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr5TRASf6M7Q.woff2';

async function fetchFont(): Promise<ArrayBuffer> {
  const res = await fetch(FONT_URL);
  return res.arrayBuffer();
}

export async function generateProposalPDF(dealId: string, tenantId: string): Promise<Buffer> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    include: {
      lead: { select: { name: true, email: true, company: true, phone: true } },
      company: { select: { name: true, domain: true } },
      assignedUser: { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  });

  if (!deal) {
    const err = new Error('Deal not found') as any;
    err.statusCode = 404;
    throw err;
  }

  const clientName = deal.lead?.name ?? deal.company?.name ?? 'Cliente';
  const clientCompany = deal.lead?.company ?? deal.company?.name ?? '';
  const clientEmail = deal.lead?.email ?? '';
  const salesRep = deal.assignedUser?.name ?? '';
  const closeDate = deal.expectedCloseDate
    ? deal.expectedCloseDate.toLocaleDateString('pt-BR')
    : '';
  const valueFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(deal.value));

  const fontData = await fetchFont();
  const font = { NotoSans: { data: fontData, fallback: true } };

  const template: Template = {
    basePdf: { width: 210, height: 297, padding: [20, 20, 20, 20] },
    schemas: [
      [
        {
          name: 'header',
          type: 'text',
          position: { x: 20, y: 20 },
          width: 170,
          height: 12,
          fontSize: 20,
          fontName: 'NotoSans',
          fontColor: '#1e3a5f',
          alignment: 'left',
        },
        {
          name: 'subheader',
          type: 'text',
          position: { x: 20, y: 36 },
          width: 170,
          height: 8,
          fontSize: 12,
          fontName: 'NotoSans',
          fontColor: '#64748b',
          alignment: 'left',
        },
        {
          name: 'divider',
          type: 'line',
          position: { x: 20, y: 48 },
          width: 170,
          height: 0.5,
          color: '#e2e8f0',
        },
        {
          name: 'section_client',
          type: 'text',
          position: { x: 20, y: 56 },
          width: 170,
          height: 7,
          fontSize: 11,
          fontName: 'NotoSans',
          fontColor: '#374151',
          fontWeight: 'bold',
        },
        {
          name: 'client_name',
          type: 'text',
          position: { x: 20, y: 66 },
          width: 170,
          height: 7,
          fontSize: 10,
          fontName: 'NotoSans',
          fontColor: '#1f2937',
        },
        {
          name: 'client_company',
          type: 'text',
          position: { x: 20, y: 75 },
          width: 170,
          height: 7,
          fontSize: 10,
          fontName: 'NotoSans',
          fontColor: '#1f2937',
        },
        {
          name: 'client_email',
          type: 'text',
          position: { x: 20, y: 84 },
          width: 170,
          height: 7,
          fontSize: 10,
          fontName: 'NotoSans',
          fontColor: '#1f2937',
        },
        {
          name: 'divider2',
          type: 'line',
          position: { x: 20, y: 95 },
          width: 170,
          height: 0.5,
          color: '#e2e8f0',
        },
        {
          name: 'section_deal',
          type: 'text',
          position: { x: 20, y: 103 },
          width: 170,
          height: 7,
          fontSize: 11,
          fontName: 'NotoSans',
          fontColor: '#374151',
          fontWeight: 'bold',
        },
        {
          name: 'deal_name',
          type: 'text',
          position: { x: 20, y: 113 },
          width: 170,
          height: 7,
          fontSize: 10,
          fontName: 'NotoSans',
          fontColor: '#1f2937',
        },
        {
          name: 'deal_value',
          type: 'text',
          position: { x: 20, y: 122 },
          width: 170,
          height: 10,
          fontSize: 18,
          fontName: 'NotoSans',
          fontColor: '#2563eb',
          fontWeight: 'bold',
        },
        {
          name: 'deal_close',
          type: 'text',
          position: { x: 20, y: 136 },
          width: 170,
          height: 7,
          fontSize: 10,
          fontName: 'NotoSans',
          fontColor: '#1f2937',
        },
        {
          name: 'deal_notes',
          type: 'text',
          position: { x: 20, y: 150 },
          width: 170,
          height: 60,
          fontSize: 10,
          fontName: 'NotoSans',
          fontColor: '#374151',
        },
        {
          name: 'footer',
          type: 'text',
          position: { x: 20, y: 270 },
          width: 170,
          height: 7,
          fontSize: 9,
          fontName: 'NotoSans',
          fontColor: '#94a3b8',
          alignment: 'center',
        },
      ],
    ],
  };

  const inputs = [
    {
      header: `Proposta Comercial — ${deal.tenant.name}`,
      subheader: `Negócio: ${deal.name}`,
      section_client: 'Dados do Cliente',
      client_name: `Nome: ${clientName}`,
      client_company: clientCompany ? `Empresa: ${clientCompany}` : '',
      client_email: clientEmail ? `E-mail: ${clientEmail}` : '',
      section_deal: 'Detalhes da Proposta',
      deal_name: `Descrição: ${deal.name}`,
      deal_value: valueFormatted,
      deal_close: closeDate ? `Previsão de fechamento: ${closeDate}` : '',
      deal_notes: deal.notes ?? '',
      footer: salesRep
        ? `Gerado por ${salesRep} via VYD Engage`
        : 'Gerado via VYD Engage',
    },
  ];

  const pdf = await generate({ template, inputs, options: { font } });
  return Buffer.from(pdf.buffer);
}
