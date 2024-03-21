// https://www.npmjs.com/package/search-google-geocode
// https://www.npmjs.com/package/bigdatacloud-reverse-geocodingv2
// https://www.npmjs.com/package/reverse-geocoding
// https://www.npmjs.com/package/mime-types
// https://www.npmjs.com/package/symlink-dir
// https://www.npmjs.com/package/filelink
// - Objectif Archiver les photos sur un disque externe et conserver les thumbnails sur l'ordinateur local
// - archiver sous forme year/month/date/2001-12-01_10-32-59-nom-fichier.png
// - pays/province/ville/rue => symlink
// - conserver structure des répertoire d'origine avec de symlink
// var geocoder = require('search-google-geocode');


// 'use strict'
const filelink = require('filelink')
import ReverseGeocode, { ILocation, IGeocode } from "bigdatacloud-reverse-geocoding";

var path = require('path');
import {ExifParserFactory} from 'ts-exif-parser';
var fs = require('fs');
const imageThumbnail = require('image-thumbnail');
var mime = require('mime-types')

export class Photo {

  private root_path:string;
  private file_path:string;
  private year: string|undefined
  private month: string|undefined
  private day: string|undefined
  private hour: string|undefined
  private minute: string|undefined
  private second: string|undefined
  private longitude: number|undefined=undefined;
  private latitude: number|undefined=undefined;

  constructor(root_path: string,file_path:string) {
    this.root_path = root_path;
    this.file_path = file_path;
  }

  getNewName() : string{
    return this.getCreationDate()+"-"+this.getFilename();
  }

  async archive(archive_path:string, thumbnail_path:string|undefined, photo_path:string|undefined): Promise<any>{
    let symlink_geocoding_filename:string = "";
      let symlink_photo_filename:string = "";

    this.extract_exif_data();
    let archive_filename = this.archive_photo(archive_path);
    let thumbnail_filename =  await this.generateThumbnail(archive_filename);

    if(photo_path){
      symlink_geocoding_filename = await this.generateGeocodedFileLink(photo_path,thumbnail_filename)
      symlink_photo_filename = path.join(photo_path,path.dirname(this.file_path),this.getNewName());
      await this.createSymlink(thumbnail_filename,symlink_photo_filename);
    }
    return {archive_filename,thumbnail_filename,symlink_geocoding_filename,symlink_photo_filename};
  } 


  private async generateGeocodedFileLink(photo_path:string|undefined, filename:string): Promise<string> {
    let symlink_thumbnail_filename:string = "";
    if(photo_path){
      symlink_thumbnail_filename = await this.createSimlink(symlink_thumbnail_filename, photo_path, filename);
    }
    return symlink_thumbnail_filename;
  }

  private async createSimlink(symlink_thumbnail_filename: string, photo_path: string, filename: string) {
    let geoPath = await this.reverseGeolocationPath();
    if (geoPath) {
      symlink_thumbnail_filename = path.join(photo_path, geoPath, this.getNewName());
      await this.createSymlink(filename, symlink_thumbnail_filename!);
    }
    return symlink_thumbnail_filename;
  }

  private async reverseGeolocationPath(): Promise<string|undefined> {
    let geoPath:string = ""; 
    if(this.longitude){
      const geocode = new ReverseGeocode();
      const location: ILocation = { lat: this.latitude!, long: this.longitude!};
      const place: IGeocode = await geocode.locate(location);
    
      let index:any;
      for (index in place.localityInfo.administrative) {
          geoPath = path.join(geoPath,place.localityInfo.administrative![index].name);
      }
    }
    if(geoPath.length == 0){
      return undefined
    } else {
      return geoPath;
    }
  }
 
  private async createSymlink(source:string,destination:string){
    // console.log(source);
    // console.log(destination);
   
    await filelink(source, destination, {
      force: true,
      mkdirp: true
    });
  }

  public getExifTags(){
    const buf = fs.readFileSync(this.getSourcePath());
    const parser = ExifParserFactory.create(buf).parse();
    return  parser.tags;
  }
  private async extract_exif_data(){
    let nbMillisecond:number = 0;
    let tags = this.getExifTags();      

    if(tags != undefined &&  Object.keys(tags!).length > 0){
      nbMillisecond = tags!.DateTimeOriginal! * 1000;
      this.longitude = tags!.GPSLongitude || 0.0;
      this.latitude = tags!.GPSLatitude || 0.0;
    } else {
      const{birthtime} = fs.statSync(this.getSourcePath());
      nbMillisecond = birthtime.getTime();
    }
   
    this.millisecondToYearMontDayHourMinSec(nbMillisecond);
  }

  private millisecondToYearMontDayHourMinSec(nbMillisecond: number) {
    let date = new Date(nbMillisecond);
    this.month = date.toLocaleString("en-US", { month: "2-digit" }); // 12
    this.day = date.toLocaleString("en-US", { day: "2-digit" }); // 09
    this.year = date.toLocaleString("en-US", { year: "numeric" }); // 2019
    let hms: string = date.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, second: "2-digit", timeZone: 'UTC' }); // 10 AM
    this.hour = hms.substr(0, 2);
    this.minute = hms.substr(3, 2);
    this.second = hms.substr(6, 2);
  }

  private getSourcePath(): string{
    return path.join(this.root_path,this.file_path);
  }

  private getCreationDate(): string|undefined {
   let humanDateFormat: string|undefined = undefined;
    humanDateFormat = this.year+"-"+this.month+"-"+this.day+"_"+this.hour+"-"+this.minute+"-"+this.second;
    return humanDateFormat?.toString();
  }
  
  private getFilename():string{
    return path.basename(this.getSourcePath()); 
  }
  
  // year/mon/day
  private getYearMonthDayPath(): string{
    return path.join(this.year,this.month,this.day);
  }

  private async generateThumbnail(new_archive_filename:string) : Promise<string>  {
    let thumbnal_filename = "";

      const stream = fs.createReadStream(new_archive_filename)
      const thumbnail = await imageThumbnail(stream);

        thumbnal_filename = path.join(
          path.dirname(this.root_path),
          'thumbnail',
          this.getYearMonthDayPath(),
          this.getNewName());

          // console.log(thumbnal_filename);
          if (!fs.existsSync(path.dirname(thumbnal_filename))) 
            fs.mkdirSync(path.dirname(thumbnal_filename), { recursive: true }); 

        fs.writeFileSync(thumbnal_filename, thumbnail);


    return thumbnal_filename;
  }

  private  archive_photo(archive_path:string): string {

    let new_path = path.join(archive_path,this.getYearMonthDayPath());
    if (!fs.existsSync(new_path)) 
      fs.mkdirSync(new_path, { recursive: true }); 

    let archive_filenamne = path.join(new_path,this.getNewName());
    fs.copyFileSync(this.getSourcePath(),archive_filenamne);
    
    return archive_filenamne;
  }

}
