import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { ExifParserFactory } from 'ts-exif-parser';
import imageThumbnail from 'image-thumbnail';
import ReverseGeocode, { ILocation, IGeocode } from 'bigdatacloud-reverse-geocoding';
import filelink from 'filelink';

// Chargement des variables d'environnement depuis le fichier .env
dotenv.config();

abstract class PhotoAbstract {
    protected rootPath: string;
    protected archivePath: string;
    protected thumbnailPath: string;
    protected photoPath: string;

    constructor() {
        this.rootPath = process.env.ROOT_PATH || 'C:\\Users\\maxen\\Documents\\GitHub\\typescript-tdd-kata\\src\\__tests__';
        this.archivePath = process.env.ARCHIVE_PATH || path.join(this.rootPath, 'archive');
        this.thumbnailPath = process.env.THUMBNAIL_PATH || path.join(this.rootPath, 'thumbnails');
        this.photoPath = process.env.PHOTO_PATH || path.join(this.rootPath, 'photos');
    }

    abstract archive(archivePath: string, thumbnailPath?: string, photoPath?: string): Promise<{ archivedFilePath: string, thumbnailFilePath?: string, symlinkFilePath?: string }>;
    abstract generateThumbnail(newArchiveFilename: string): Promise<string>;

    protected async extractExifData(filePath: string): Promise<any> {
        const buf = fs.readFileSync(filePath);
        const parser = ExifParserFactory.create(buf).parse();
        return parser.tags || {};
    }

    protected async reverseGeolocationPath(latitude: number, longitude: number): Promise<string | undefined> {
        let geoPath = '';
        const geocode = new ReverseGeocode();
        const location: ILocation = { lat: latitude, long: longitude };
        const place: IGeocode = await geocode.locate(location);

        for (const admin of place.localityInfo.administrative || []) {
            geoPath = path.join(geoPath, admin.name || '');
        }

        return geoPath.length > 0 ? geoPath : undefined;
    }

    protected async createSymlink(source: string, destination: string): Promise<void> {
        await filelink(source, destination, { force: true, mkdirp: true });
    }

    protected async generateThumbnailFromStream(inputStream: fs.ReadStream, destination: string): Promise<void> {
        const thumbnail = await imageThumbnail(inputStream);
        await fs.promises.writeFile(destination, thumbnail);
    }


}

export default PhotoAbstract;
