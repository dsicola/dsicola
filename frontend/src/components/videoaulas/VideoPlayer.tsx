import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { videoAulasApi } from '@/services/api';
import { Loader2, Video } from 'lucide-react';

interface VideoPlayerProps {
  videoAula: {
    id: string;
    titulo: string;
    urlVideo: string;
    tipoVideo: 'YOUTUBE' | 'VIMEO' | 'UPLOAD' | 'BUNNY';
  };
  onProgressUpdate?: (percentual: number) => void;
}

/**
 * Componente de player de vídeo responsivo
 * - YouTube/Vimeo: usa iframe (progresso limitado por segurança)
 * - UPLOAD: usa HTML5 video com signed URL (progresso completo)
 * - Sem autoplay
 * - Trata expiração de signed URL
 * - Envia progresso automaticamente (UPLOAD)
 */
export function VideoPlayer({ videoAula, onProgressUpdate }: VideoPlayerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressSentRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Função para carregar signed URL (definida antes do useEffect que a usa)
  const loadSignedUrl = useCallback(async () => {
    // Verificar se está montado antes de fazer qualquer setState
    if (!isMountedRef.current) {
      return;
    }

    try {
      if (!isMountedRef.current) return;
      setLoadingUrl(true);
      if (!isMountedRef.current) return;
      setError(null);
      
      const url = await videoAulasApi.getSignedUrl(videoAula.id);
      
      // Verificar se ainda está montado antes de atualizar estado
      if (!isMountedRef.current) {
        return;
      }
      
      setSignedUrl(url);
    } catch (err: any) {
      // Verificar se ainda está montado antes de atualizar estado
      if (!isMountedRef.current) {
        return;
      }
      
      console.error('Erro ao carregar signed URL:', err);
      setError('Erro ao carregar vídeo. Tente novamente.');
    } finally {
      // Verificar se ainda está montado antes de atualizar estado
      if (isMountedRef.current) {
        setLoadingUrl(false);
      }
    }
  }, [videoAula.id]);

  // Carregar signed URL para vídeos tipo UPLOAD
  useEffect(() => {
    isMountedRef.current = true;
    
    if (videoAula.tipoVideo === 'UPLOAD') {
      loadSignedUrl();
    }
    
    // Cleanup: marcar como desmontado
    return () => {
      isMountedRef.current = false;
    };
  }, [videoAula.id, videoAula.tipoVideo, loadSignedUrl]);

  // Handler para tratar erro de carregamento do vídeo (pode ser URL expirada)
  const handleVideoError = () => {
    if (videoAula.tipoVideo === 'UPLOAD' && videoRef.current) {
      // Tentar recarregar signed URL se o vídeo falhar
      loadSignedUrl();
    }
  };

  // Enviar progresso para o backend (apenas para UPLOAD)
  // Se onProgressUpdate não for fornecido, não salva progresso (ex: preview administrativo)
  const updateProgress = useCallback(async (percentual: number) => {
    // Throttle: só enviar se mudou pelo menos 5% desde a última atualização
    if (Math.abs(percentual - lastProgressSentRef.current) < 5) {
      return;
    }

    // Se onProgressUpdate não for fornecido, não salvar progresso (preview administrativo)
    if (!onProgressUpdate) {
      return;
    }

    try {
      await videoAulasApi.updateProgress(videoAula.id, percentual);
      lastProgressSentRef.current = percentual;
      onProgressUpdate(percentual);
    } catch (err) {
      console.error('Erro ao atualizar progresso:', err);
      // Não bloquear a reprodução em caso de erro
    }
  }, [videoAula.id, onProgressUpdate]);

  // Handler para timeupdate (UPLOAD apenas)
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && videoAula.tipoVideo === 'UPLOAD') {
      const video = videoRef.current;
      if (video.duration > 0) {
        const percentual = (video.currentTime / video.duration) * 100;
        
        // Cancelar timeout anterior
        if (progressUpdateTimeoutRef.current) {
          clearTimeout(progressUpdateTimeoutRef.current);
        }

        // Enviar progresso após 2 segundos de reprodução contínua
        progressUpdateTimeoutRef.current = setTimeout(() => {
          updateProgress(percentual);
        }, 2000);
      }
    }
  }, [videoAula.tipoVideo, updateProgress]);

  // Handler para quando o vídeo terminar (UPLOAD apenas)
  const handleVideoEnded = useCallback(() => {
    if (videoAula.tipoVideo === 'UPLOAD' && onProgressUpdate) {
      updateProgress(100);
      onProgressUpdate(100);
    }
  }, [videoAula.tipoVideo, updateProgress, onProgressUpdate]);

  // Cleanup: limpar timeouts apenas (não alterar estado)
  useEffect(() => {
    return () => {
      // Limpar timeout apenas - não alterar estado
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
        progressUpdateTimeoutRef.current = null;
      }
    };
  }, []);

  // Bunny.net com b-cdn.net (HLS): usar video + hls.js
  if (videoAula.tipoVideo === 'BUNNY' && videoAula.urlVideo.includes('b-cdn.net')) {
    return (
      <BunnyHlsPlayer
        url={videoAula.urlVideo.trim().startsWith('http') ? videoAula.urlVideo : `https://${videoAula.urlVideo.trim()}`}
        title={videoAula.titulo}
      />
    );
  }

  // YouTube/Vimeo/Bunny.net (mediadelivery.net): usar iframe (progresso limitado)
  if (videoAula.tipoVideo === 'YOUTUBE' || videoAula.tipoVideo === 'VIMEO' || videoAula.tipoVideo === 'BUNNY') {
    const embedUrl = getEmbedUrl(videoAula.urlVideo, videoAula.tipoVideo);
    return (
      <iframe
        src={embedUrl}
        title={videoAula.titulo}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading={videoAula.tipoVideo === 'BUNNY' ? 'eager' : undefined}
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  // UPLOAD: usar HTML5 video com signed URL
  if (videoAula.tipoVideo === 'UPLOAD') {
    if (loadingUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error || !signedUrl) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4">
          <Video className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            {error || 'Erro ao carregar vídeo'}
          </p>
        </div>
      );
    }

    return (
      <video
        ref={videoRef}
        src={signedUrl}
        controls
        className="w-full h-full"
        onError={handleVideoError}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
      >
        Seu navegador não suporta o elemento de vídeo.
      </video>
    );
  }

  return null;
}

/**
 * Player para URLs Bunny.net b-cdn.net (HLS)
 */
function BunnyHlsPlayer({ url, title }: { url: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Bunny b-cdn.net: URL pode ser a base (ex.: .../ce7a71b9-c8) ou playlist (.../playlist.m3u8)
    const hlsUrl = /\.m3u8(\?|$)/i.test(url) ? url : `${url.replace(/\/?$/, '')}/playlist.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal && data.type === Hls.ErrorTypes.NETWORK) {
          setError('Erro ao carregar o vídeo. Verifique a URL.');
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      return () => { video.src = ''; };
    }
    setError('Reprodução HLS não suportada neste navegador.');
  }, [url]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4">
        <Video className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      className="w-full h-full"
      title={title}
      playsInline
    >
      Seu navegador não suporta o elemento de vídeo.
    </video>
  );
}

/**
 * Converte URL do YouTube/Vimeo para URL de embed
 */
function getEmbedUrl(urlVideo: string, tipoVideo: string): string {
  if (tipoVideo === 'YOUTUBE') {
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = urlVideo.match(youtubeRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return urlVideo;
  } else if (tipoVideo === 'VIMEO') {
    const vimeoRegex = /vimeo\.com\/(\d+)/;
    const match = urlVideo.match(vimeoRegex);
    if (match && match[1]) {
      return `https://player.vimeo.com/video/${match[1]}`;
    }
    return urlVideo;
  } else if (tipoVideo === 'BUNNY') {
    // Bunny.net: iframe usa /embed/; "Direct Play URL" vem como /play/ → normalizar para /embed/
    // preload=true + preloadMetadata=auto: facilitam o play ao clicar (Bunny docs)
    if (urlVideo.includes('mediadelivery.net')) {
      let u = urlVideo.startsWith('http') ? urlVideo : `https://${urlVideo.trim()}`;
      try {
        const url = new URL(u);
        if (url.pathname.startsWith('/play/')) {
          url.pathname = url.pathname.replace(/^\/play\//, '/embed/');
        }
        url.searchParams.set('preload', 'true');
        url.searchParams.set('responsive', 'true');
        return url.toString();
      } catch {
        return u;
      }
    }
    return urlVideo;
  }
  return urlVideo;
}
