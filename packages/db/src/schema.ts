import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================
// Enums
// ============================================
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  WARDEN = 'WARDEN',
  SECURITY = 'SECURITY',
}

export enum AlertType {
  FIGHT = 'FIGHT',
  LIQUOR = 'LIQUOR',
  SMOKING = 'SMOKING',
  ANIMAL_MONKEY = 'ANIMAL_MONKEY',
  ANIMAL_DOG = 'ANIMAL_DOG',
  UNAUTHORIZED_PERSON = 'UNAUTHORIZED_PERSON',
  WEAPON = 'WEAPON',
  ANIMAL_INTRUSION = 'ANIMAL_INTRUSION',
  LOITERING = 'LOITERING',
  CROWD_SURGE = 'CROWD_SURGE',
  TRESPASSING = 'TRESPASSING',
  FOOD_INTRUSION = 'FOOD_INTRUSION',
  FIRE_DETECTED = 'FIRE_DETECTED',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlarmMode {
  ALWAYS_ON = 'always_on',
  USER_CHOICE = 'user_choice',
  ALWAYS_OFF = 'always_off',
}

// ============================================
// Transformations to Map _id to id
// ============================================
const toJSON = {
  virtuals: true,
  versionKey: false,
  transform: (doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
};

const toObject = {
  virtuals: true,
  versionKey: false,
  transform: (doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
};

// ============================================
// User Model
// ============================================
export interface IUser extends Document<string> {
  id: string; // From virtual
  email: string;
  name: string;
  password?: string;
  role: Role;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(Role), default: Role.WARDEN },
    createdAt: { type: Date, default: Date.now },
  },
  { toJSON, toObject }
);

// ============================================
// Hostel Model
// ============================================
export interface IHostel extends Document<string> {
  id: string;
  name: string;
  floors: number;
  floorList?: IFloor[]; // populated virtual
}

const HostelSchema = new Schema<IHostel>(
  {
    _id: { type: String, required: true }, // Custom ID ("A", "C", "D1")
    name: { type: String, required: true },
    floors: { type: Number, required: true },
  },
  { toJSON, toObject }
);
// Define virtual for floorList
HostelSchema.virtual('floorList', {
  ref: 'Floor',
  localField: '_id',
  foreignField: 'hostelId',
});

// ============================================
// Floor Model
// ============================================
export interface IFloor extends Document<string> {
  id: string;
  hostelId: string;
  number: number;
  cameras?: ICamera[]; // populated virtual
  hostel?: IHostel;
}

const FloorSchema = new Schema<IFloor>(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() }, // String CUID equivalent
    hostelId: { type: String, ref: 'Hostel', required: true },
    number: { type: Number, required: true },
  },
  { toJSON, toObject }
);
// Virtual for cameras
FloorSchema.virtual('cameras', {
  ref: 'Camera',
  localField: '_id',
  foreignField: 'floorId',
});
FloorSchema.virtual('hostel', {
  ref: 'Hostel',
  localField: 'hostelId',
  foreignField: '_id',
  justOne: true,
});
FloorSchema.index({ hostelId: 1, number: 1 }, { unique: true });

// ============================================
// Camera Model
// ============================================
export interface IRestrictedZone {
  label: string;
  polygon: number[][];
  isFullFrame: boolean;
}

export interface ICamera extends Document<string> {
  id: string;
  label: string;
  floorId: string;
  rtspUrl: string;
  posX: number;
  posY: number;
  isOnline: boolean;
  description?: string;
  restrictedZones?: IRestrictedZone[];
  alarmMode?: string;
  surveillanceActive?: boolean;
  lastSeenAt?: Date;
  alerts?: IAlert[]; // populated virtual
  floor?: IFloor;
}

const CameraSchema = new Schema<ICamera>(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    label: { type: String, required: true },
    floorId: { type: String, ref: 'Floor', required: true },
    rtspUrl: { type: String, required: true },
    posX: { type: Number, required: true },
    posY: { type: Number, required: true },
    isOnline: { type: Boolean, default: true },
    description: { type: String },
    restrictedZones: [{
      label: { type: String },
      polygon: { type: [[Number]] },
      isFullFrame: { type: Boolean, default: false },
    }],
    alarmMode: { type: String, enum: Object.values(AlarmMode), default: AlarmMode.USER_CHOICE },
    surveillanceActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
  },
  { toJSON, toObject }
);
// Virtual for alerts
CameraSchema.virtual('alerts', {
  ref: 'Alert',
  localField: '_id',
  foreignField: 'cameraId',
});
CameraSchema.virtual('floor', {
  ref: 'Floor',
  localField: 'floorId',
  foreignField: '_id',
  justOne: true,
});

// ============================================
// Alert Model
// ============================================
export interface IAlert extends Document<string> {
  id: string;
  cameraId: string;
  type: AlertType;
  severity: Severity;
  description: string;
  thumbnail?: string;
  resolved: boolean;
  resolvedBy?: string;
  createdAt: Date;
  resolvedAt?: Date;
  frameSnapshot?: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
  zone?: string;
  actionTaken?: string;
  read?: boolean;
  detectedClass?: string;
  confidence?: number;
  camera?: ICamera;
}

const AlertSchema = new Schema<IAlert>(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    cameraId: { type: String, ref: 'Camera', required: true },
    type: { type: String, enum: Object.values(AlertType), required: true },
    severity: { type: String, enum: Object.values(Severity), default: Severity.HIGH },
    description: { type: String, required: true },
    thumbnail: { type: String },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    frameSnapshot: { type: String },
    boundingBox: {
      x: { type: Number },
      y: { type: Number },
      w: { type: Number },
      h: { type: Number },
    },
    zone: { type: String },
    actionTaken: { type: String },
    read: { type: Boolean, default: false },
    detectedClass: { type: String },
    confidence: { type: Number },
  },
  { toJSON, toObject }
);
AlertSchema.virtual('camera', {
  ref: 'Camera',
  localField: 'cameraId',
  foreignField: '_id',
  justOne: true,
});
AlertSchema.index({ cameraId: 1 });
AlertSchema.index({ createdAt: 1 });
AlertSchema.index({ resolved: 1 });
AlertSchema.index({ read: 1 });
AlertSchema.index({ type: 1 });

// ============================================
// EventLog Model (ML Detection Events)
// ============================================
export interface IEventLog extends Document<string> {
  id: string;
  cameraId: string;
  type: string;
  riskLevel: string;
  detectedClass: string;
  confidence: number;
  zone?: string;
  timestamp: Date;
  frameSnapshot?: string;
  actionTaken?: string;
  resolved: boolean;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

const EventLogSchema = new Schema<IEventLog>(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    cameraId: { type: String, ref: 'Camera', required: true },
    type: { type: String, required: true },
    riskLevel: { type: String, enum: ['RED', 'YELLOW', 'GREEN'], default: 'YELLOW' },
    detectedClass: { type: String, required: true },
    confidence: { type: Number, required: true },
    zone: { type: String },
    timestamp: { type: Date, default: Date.now },
    frameSnapshot: { type: String },
    actionTaken: { type: String },
    resolved: { type: Boolean, default: false },
    boundingBox: {
      x: { type: Number },
      y: { type: Number },
      w: { type: Number },
      h: { type: Number },
    },
  },
  { toJSON, toObject }
);
EventLogSchema.index({ cameraId: 1 });
EventLogSchema.index({ timestamp: -1 });
EventLogSchema.index({ type: 1 });
EventLogSchema.index({ riskLevel: 1 });

// ============================================
// Initialize and Export Models
// ============================================
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema, 'users');
export const Hostel: Model<IHostel> = mongoose.models.Hostel || mongoose.model<IHostel>('Hostel', HostelSchema, 'hostels');
export const Floor: Model<IFloor> = mongoose.models.Floor || mongoose.model<IFloor>('Floor', FloorSchema, 'floors');
export const Camera: Model<ICamera> = mongoose.models.Camera || mongoose.model<ICamera>('Camera', CameraSchema, 'cameras');
export const Alert: Model<IAlert> = mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema, 'alerts');
export const EventLog: Model<IEventLog> = mongoose.models.EventLog || mongoose.model<IEventLog>('EventLog', EventLogSchema, 'eventlogs');
