import PDFDocument from 'pdfkit';
import type { PautaConclusaoCicloSecundarioResultado } from './pautaConclusaoCicloSecundario.service.js';

/**
 * PDF institucional da pauta de conclusão do ciclo (Ensino Secundário).
 */
export async function gerarPdfPautaConclusaoCicloSecundario(opts: {
  pauta: PautaConclusaoCicloSecundarioResultado;
  alunoNome: string;
  instituicaoNome: string;
}): Promise<Buffer> {
  const { pauta, alunoNome, instituicaoNome } = opts;
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'Pauta de conclusão do ciclo' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    doc.fontSize(14).text(instituicaoNome, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text('Pauta de conclusão do ciclo (Ensino Secundário)', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10);
    doc.text(`Estudante: ${alunoNome}`, { align: 'left' });
    doc.text(
      `Ciclo: ${pauta.ordensCiclo.map((o) => `${o}ª`).join(', ')} | Média final do curso: ${
        pauta.mediaFinalCurso != null ? String(pauta.mediaFinalCurso) : '—'
      } | Tipo: ${pauta.tipoMediaFinalCurso === 'PONDERADA_CARGA' ? 'Ponderada (carga horária)' : 'Simples'}`,
    );
    doc.text(
      `Situação: ${pauta.incompleto ? 'Incompleta' : pauta.aprovadoCurso ? 'Aprovado (critério configurado)' : 'Não aprovado'} (mín. ${pauta.percentualMinimo} valores)`,
    );
    doc.moveDown(0.6);

    if (pauta.avisos.length > 0) {
      doc.fontSize(9).fillColor('#444').text('Avisos:', { underline: true });
      pauta.avisos.forEach((a) => doc.text(`• ${a}`, { indent: 8 }));
      doc.fillColor('#000');
      doc.moveDown(0.4);
    }

    const ordens = pauta.ordensCiclo;
    const fontSize = 7;
    doc.fontSize(fontSize);
    const startX = 40;
    let y = doc.y;
    const lineH = 13;
    const col0 = 118;
    const colOrd = 34;
    const colMed = 44;
    const colApr = 34;

    doc.font('Helvetica-Bold');
    doc.text('Disciplina', startX, y, { width: col0 });
    let x = startX + col0;
    for (const o of ordens) {
      doc.text(`${o}ª`, x, y, { width: colOrd, align: 'center' });
      x += colOrd;
    }
    doc.text('Média', x, y, { width: colMed, align: 'center' });
    x += colMed;
    doc.text('Apr.', x, y, { width: colApr, align: 'center' });
    y += lineH + 2;
    doc.font('Helvetica');

    for (const d of pauta.disciplinas) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc.text(d.disciplinaNome.substring(0, 36), startX, y, { width: col0 - 2 });
      x = startX + col0;
      for (const slot of d.notasPorClasse) {
        const txt = slot.mediaFinal != null ? String(slot.mediaFinal) : '—';
        doc.text(txt, x, y, { width: colOrd, align: 'center' });
        x += colOrd;
      }
      doc.text(d.mediaDisciplinaCiclo != null ? String(d.mediaDisciplinaCiclo) : '—', x, y, {
        width: colMed,
        align: 'center',
      });
      x += colMed;
      doc.text(d.aprovadoDisciplina ? 'Sim' : 'Não', x, y, { width: colApr, align: 'center' });
      y += lineH;
    }

    doc.fontSize(8).fillColor('#555');
    doc.text(`Gerado em ${new Date().toLocaleString('pt-AO')}`, startX, y + 12, { align: 'right' });
    doc.fillColor('#000');

    doc.end();
  });

  return Buffer.concat(chunks);
}
