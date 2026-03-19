/**
 * Gera DOCX modelo em branco para certificados com placeholders já inseridos.
 * Destinado a utilizadores não técnicos: descarregam o ficheiro, personalizam no Word (logos, texto estático) e carregam de volta.
 * Nunca precisam de escrever {{placeholders}} manualmente.
 */
import PizZip from 'pizzip';

const DOC_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t xml:space="preserve">CERTIFICADO DE CONCLUSÃO</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Certificamos que </w:t></w:r><w:r><w:t>{{NOME_ALUNO}}</w:t></w:r><w:r><w:t xml:space="preserve"> concluiu o curso/formação em </w:t></w:r><w:r><w:t>{{CURSO}}</w:t></w:r><w:r><w:t xml:space="preserve"> no ano letivo </w:t></w:r><w:r><w:t>{{ANO_LETIVO}}</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Documento n.º </w:t></w:r><w:r><w:t>{{N_DOCUMENTO}}</w:t></w:r><w:r><w:t xml:space="preserve"> — Data de emissão: </w:t></w:r><w:r><w:t>{{DATA_EMISSAO}}</w:t></w:r></w:p>
    <w:p/><w:p/>
    <w:p><w:r><w:t>{{INSTITUICAO_NOME}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>{{CARGO_ASSINATURA_1}}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" Id="rId1"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

/**
 * Gera buffer DOCX de certificado em branco com placeholders.
 * Placeholders: NOME_ALUNO, CURSO, ANO_LETIVO, N_DOCUMENTO, DATA_EMISSAO, INSTITUICAO_NOME, CARGO_ASSINATURA_1
 */
export function generateBlankCertificateDocx(): Buffer {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('word/document.xml', DOC_XML);
  zip.file('word/_rels/document.xml.rels', DOC_RELS);
  return zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  }) as Buffer;
}
