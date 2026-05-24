"use client";

import dynamic from "next/dynamic";

const MapComponent = dynamic(
    () => import("@/components/media/Map"),
    {
        ssr: false,
        loading: () => (
            <div className="h-full w-full flex items-center justify-center bg-background text-muted text-xs tracking-widest">
                Initializing Globe...
            </div>
        )
    }
);

export default function MapPage() {
    return (
        <div className="h-[calc(100vh-4rem)] w-full relative">
            <MapComponent />
        </div>
    );
}