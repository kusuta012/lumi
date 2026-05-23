"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Lightbox from "./Lightbox"

const customIcon = L.divIcon({
    html: `
        <svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ea580c" width="30" height="30">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
    `,
    className: "lumi-custom-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30], // I'm sleepy :)
});

interface LocatedPhoto {
    id: string;
    filename: string;
    gpsLat: number;
    gpsLng: number;
    mimetype: string; 
}

export default function Map() {
    const [photos, setPhotos] = useState<LocatedPhoto[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/media/locations")
            .then((res) => {
                if (!res.ok) throw new Error("api returned" + res.status);
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    setPhotos(data);
                } else {
                    setPhotos([]);
                }
            })
            .catch((err) => {
                console.error("Failed to laod map photos", err);
                setPhotos([]);
            });
    }, []);

    return (
        <div className="h-full w-full relative">
        <MapContainer center={[20, 0]} zoom={2} minZoom={2} maxBounds={[[-90, -180], [90, 180]]} className="h-full w-full" style={{ background: "#0a0a0a" }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

            {photos && Array.isArray(photos) && photos.map((photo) => (
                <Marker key={photo.id} position={[photo.gpsLat, photo.gpsLng]} icon={customIcon}>
                    <Popup className="lumi-map-popup">
                        <div className="text-center p-1 flex flex-col items-center">
                            <img src={`/api/media/${photo.id}?size=small`} onClick={() => setSelectedIndex(photos.indexOf(photo))} className="w-24 h-24 object-cover rounded-lg border border-neutral-800 mb-2 shadow-md cursor-pointer" alt={photo.filename} />
                            <p className="text-xs font-bold text-neutral-800 truncate max-w-[120px]">
                                {photo.filename}
                            </p>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
        {selectedIndex !== null && (
            <Lightbox items={photos} index={selectedIndex} setIndex={(i: number) => setSelectedIndex(i)} onClose={() => setSelectedIndex(null)} />
        )}
        </div>
    );
}