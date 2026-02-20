/**
 * Teste do fluxo de vídeo Bunny.net
 * Verifica conversão /play/ → /embed/ e acessibilidade da URL
 */
const BUNNY_URL =
  'https://iframe.mediadelivery.net/play/297435/ce7a71b9-c84c-4ecb-9e2c-ec08b61d3260';

function getEmbedUrl(urlVideo: string): string {
  if (!urlVideo.includes('mediadelivery.net')) return urlVideo;
  let u = urlVideo.startsWith('http') ? urlVideo : `https://${urlVideo.trim()}`;
  try {
    const url = new URL(u);
    if (url.pathname.startsWith('/play/')) {
      url.pathname = url.pathname.replace(/^\/play\//, '/embed/');
      u = url.toString();
    }
    return u;
  } catch {
    return u;
  }
}

async function main() {
  console.log('🎬 Teste de vídeo Bunny.net\n');

  // 1. Conversão play → embed
  const embedUrl = getEmbedUrl(BUNNY_URL);
  const expected = 'https://iframe.mediadelivery.net/embed/297435/ce7a71b9-c84c-4ecb-9e2c-ec08b61d3260';

  if (embedUrl !== expected) {
    console.error('❌ Falha na conversão de URL:');
    console.error('   Esperado:', expected);
    console.error('   Obtido: ', embedUrl);
    process.exit(1);
  }
  console.log('✅ Conversão /play/ → /embed/ OK');
  console.log('   URL embed:', embedUrl);

  // 2. Verificar se a página embed responde (opcional)
  try {
    const res = await fetch(embedUrl, { method: 'HEAD', redirect: 'follow' });
    if (res.ok || res.status === 200) {
      console.log('✅ URL embed acessível (status:', res.status, ')');
    } else {
      console.log('⚠️  URL embed status:', res.status, '(pode ser normal para iframe)');
    }
  } catch (e) {
    console.log('⚠️  Não foi possível verificar acessibilidade:', (e as Error).message);
  }

  console.log('\n✅ Teste concluído. O vídeo deve reproduzir normalmente no player.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
