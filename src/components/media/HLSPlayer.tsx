"use client";

import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function HLSPlayer({
    mediaId,
    hlsPlaylistKey,
    fallbackSrc
}: {
    mediaId: string,
    hlsPlaylistKey?: string | null,
    fallbackSrc: string
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (hlsPlaylistKey && Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
            });
            hls.loadSource(`/api/media/${mediaId}?hls=playlist.m3u8`);
            hls.attachMedia(video);

            return () => {
                hls.destroy();
            };
        }
        else if (hlsPlaylistKey && video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = `/api/media/${mediaId}?hls=playlist.m3u8`;
        }
        else {
            video.src = fallbackSrc;
        }
    }, [mediaId, hlsPlaylistKey, fallbackSrc]);

    return (
        <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full h-full object-contain outline-none animate-in zoom-in-95 duration-300" />
    );
}