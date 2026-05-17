"use client";

import { X, Info, Calendar, Camera, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function Lightbox({ item, onClose }: { item: any, onClose: () => void }) {
    return(
        <div className="fixed inset-0 z-50 bg-black flex overflow-hidden animate-in fade-in duration-200">
            <div className="flex-1 relative flex items-center justify-center p-4">
                <img src={`/api/media/${item.id}?size=large`} className="max-w-full max-h-full object-contain shadow-2xl" alt={item.filename} />
                <button onClick={onClose} className="absolute top-6 left-6 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors">
                <X className="w-6 h-6"/>
                </button>
            </div>
            <div className="w-80 bg bg-neutral-900 border-l border-neutral-800 p-6 overflow-y-auto hidden md:block">
                <h2 className="text-lg font-semibold mb-6">Info</h2>
                <div className="space-y-6">
                    <div>
                        <label className="text-xs text-neutral-500 uppercase font-bold tracking-wider">File Details</label>
                        <p className="text-sm mt-1 text-neutral-200 truncate">{item.filename}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{(item.size / 1024 / 1024).toFixed(2)} MB | {item.width} x {item.height}</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-neutral-500 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium">Date Taken</p>
                        <p className="text-xs text-neutral-400">
                            {item.dateTaken ? format(new Date(item.dateTaken), "PPP p") : "Unknown"}
                        </p>
                </div>
            </div>

            {item.cameraModel && (
                <div className="flex items-start gap-3">
                    <Camera className="w-5 h-5 text-neutral-500 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium">Camera</p>
                        <p className="text-xs text-neutral-400">{item.cameraModel}</p>
                    </div>
                </div>
            )}

            {item.gpsLat && (
                <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-neutral-500 m"/>
                    <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-xs text-neutral-400">{item.gpsLat.toFixed(4)}, {item.gpsLng.toFixed(4)}</p>
                    </div>
                </div>
            )}
        </div>
    </div>
</div>
    );
}