import Link from "next/link";
import { MapPin } from "lucide-react";
import { PlaceHighlight } from "@/server/queries/explore";

interface Props {
    places: PlaceHighlight[];
}

export default function PlacesGrid({ places }: Props) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {places.map((place) => (
                <Link href={`/search?q=${encodeURIComponent(place.city)}&mode=filename`} key={`${place.city}-${place.country}`}
                className="relative aspect-square rounded-2xl overflow-hidden border border-border shadow-md hover:border-orange-500/50 hover:shadow-xl transition-all duration-300 group bg-surface">
                    <img
                        src={`/api/media/${place.coverMediaId}?size=medium`} alt={place.city} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" 
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-sm font-bold text-foreground flex items-center gap-1.5 group-hover:text-orange-500 transition-colors">
                            <MapPin size={14} className="text-orange-500" />
                            {place.city}
                        </p>
                        <p className="text-[10px] text-muted font-bold uppercase mt-1">
                            {place.country} {place.mediaCount} {place.mediaCount === 1 ? "item" : "items"}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    );
}