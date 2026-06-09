import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync } from "fs";
import path from "path";
import os from "os";
import https from "https";
import unzipper from "unzipper";
import KDBush from "kdbush";
import * as geokdbush from "geokdbush";

export interface City {
    name: string;
    adminName: string;
    countryCode: string;
    lat: number;
    lng: number;
}

class GeonamesProvider {
    private readonly dataUrl = "https://download.geonames.org/export/dump/cities1000.zip";
    private readonly dataDir = path.join(os.tmpdir(), "lumi-geo");
    private readonly textFilePath = path.join(this.dataDir, "cities1000.txt");

    public async ensureDataExists(): Promise<void> {
        if (existsSync(this.textFilePath)) return;

        await fs.mkdir(this.dataDir, { recursive: true });
        const zipPath = path.join(this.dataDir, "cities.zip");

        await new Promise<void>((resolve, reject) => {
            https.get(this.dataUrl, (resp) => {
                if (resp.statusCode !== 200) return reject(new Error(`failed to download ${resp.statusCode}`));
                const fileStream = createWriteStream(zipPath);
                resp.pipe(fileStream);
                fileStream.on("finish", () => { fileStream.close(); resolve(); });
            }).on("error", reject);
        });

        await new Promise<void>((resolve, reject) => {
            createReadStream(zipPath)
                .pipe(unzipper.Parse())
                .on("entry", (entry) => {
                    if (entry.path === "cities1000.txt") {
                        entry.pipe(createWriteStream(this.textFilePath)).on("finish", resolve);
                    } else {
                        entry.autodrain();
                    }
                })
                .on("error", reject);
        });
        await fs.unlink(zipPath);
    }
    public async loadMem(): Promise<City[]> {
        const rawData = await fs.readFile(this.textFilePath, "utf-8");
        const lines = rawData.split("\n");
        const cities: City[] = [];
        for (const line of lines) {
            if (!line) continue;
            const columns = line.split("\t");
            if (columns.length < 14) continue;

            cities.push({
                name: columns[1],
                lat: parseFloat(columns[4]),
                lng: parseFloat(columns[5]),
                countryCode: columns[8],
                adminName: columns[10],
            });
        }
        return cities;
    }
}

class SpatialTree {
    private index: any = null;
    private cities: City[] = [];
    public build(cities: City[]) {
        this.cities = cities;
        
        try {
            this.index = new (KDBush as any)(cities.length);
            for (const c of cities) {
                this.index.add(c.lng, c.lat);
            }
            this.index.finish();
        } catch (err) {
            this.index = new (KDBush as any)(
                cities,
                (c: any) => c.lng,
                (c: any) => c.lat,
                64,
                Float64Array
            );
        }
        console.log(`kd-tree build with ${cities.length} nodes`);
    }
    public getNearest(lat: number, lng: number): City | null {
        if (!this.index) throw new Error("spatial tree not initialized");
        const results = geokdbush.around(this.index, lng, lat, 1);
        if (results.length > 0) {
            const match = results[0];
            return typeof match === "number" ? this.cities[match] : match;
        }
        return null;
    }
}

export class ReverseGeocoder {
    private static instance: ReverseGeocoder;
    private provider: GeonamesProvider;
    private tree: SpatialTree;
    private isReady: boolean = false;
    private intializationPromise: Promise<void> | null = null;
    
    private cache = new Map<string, City>();

    private constructor() {
        this.provider = new GeonamesProvider();
        this.tree = new SpatialTree();
    }

    public static getInstance(): ReverseGeocoder {
        if (!ReverseGeocoder.instance) {
            ReverseGeocoder.instance = new ReverseGeocoder();
        }
        return ReverseGeocoder.instance;
    }

    private async _initialize() {
        await this.provider.ensureDataExists();
        const cities = await this.provider.loadMem();
        this.tree.build(cities);
        this.isReady = true;
    }

    public async initialize(): Promise<void> {
        if (this.isReady) return;
        if (!this.intializationPromise) {
            this.intializationPromise = this._initialize();
        }
        return this.intializationPromise;
    }

    public async resolve(lat: number, lng: number): Promise<City | null> {
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (this.cache.has(key)) {
            return this.cache.get(key) || null;
        }

        try {
            const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(2000)
            });

            if (resp.ok) {
                const data = await resp.json();
                const name = data.locality || data.city || data.principalSubdivision;

                if (name) {
                    const cityInfo: City = {
                        name: name,
                        adminName: data.principalSubdivision || "",
                        countryCode: data.countryCode ? data.countryCode.toUpperCase() : "",
                        lat,
                        lng
                    };
                    this.cache.set(key, cityInfo);
                    return cityInfo;
                }
            }
        } catch (err) {
            console.error("bigdatacloudd API error", err);
        }
        try {
            await this.initialize();
            const fallbackCity = this.tree.getNearest(lat, lng);
            if (fallbackCity) {
                this.cache.set(key, fallbackCity);
                return fallbackCity;
            }
        } catch (err) {
            console.error("offline geocoding error", err);
        }
        return null;
    }
}

export const geoChief = ReverseGeocoder.getInstance();
