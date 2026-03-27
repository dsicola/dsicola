import { describe, it, expect } from 'vitest';
import {
  resolvePautaTemplateFromConfigJson,
  DEFAULT_BUILTIN_MINI_PAUTA_ID,
} from '../services/academicTemplate.service.js';
import { angolaSecundarioV1Template } from '../pauta-engine/templates/angolaSecundarioV1.js';

describe('academicTemplate.service', () => {
  it('builtin default quando JSON vazio / null', () => {
    const t = resolvePautaTemplateFromConfigJson(null);
    expect(t.id).toBe(DEFAULT_BUILTIN_MINI_PAUTA_ID);
  });

  it('kind builtin resolve angola', () => {
    const t = resolvePautaTemplateFromConfigJson({ kind: 'builtin', builtinId: 'angola-secundario-v1' });
    expect(t.id).toBe('angola-secundario-v1');
    expect(t.computed.MT1).toBeDefined();
  });

  it('embedded usa template passado', () => {
    const t = resolvePautaTemplateFromConfigJson({
      kind: 'embedded',
      template: angolaSecundarioV1Template,
    });
    expect(t.id).toBe(angolaSecundarioV1Template.id);
  });
});
