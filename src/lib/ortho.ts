// Orthodontic case form definition + small helpers (framework-free).

export interface OrthoField {
  key: string;
  label: string;
  /** Omit for a free-text input. */
  options?: string[];
}

const YES_NO = ["لا", "نعم"];

export const EXTRAORAL: OrthoField[] = [
  { key: "nasolabial", label: "Nasolabial Angle", options: ["حاد", "طبيعي", "منفرج"] },
  { key: "lip", label: "Lip Competence", options: ["Competent", "Incompetent", "Potentially competent"] },
  { key: "mandibular", label: "Mandibular Plane Angle", options: ["منخفض", "طبيعي", "مرتفع"] },
  { key: "asymmetry", label: "Facial Asymmetry", options: ["لا يوجد", "يوجد"] },
  { key: "facial_midline", label: "Facial Midline", options: ["منطبق", "منحرف لليمين", "منحرف لليسار"] },
  { key: "smile", label: "Smile Line", options: ["منخفض", "متوسط", "مرتفع", "Gummy smile"] },
];

export const INTRAORAL: OrthoField[] = [
  { key: "dental_midline", label: "Dental Midline", options: ["منطبق", "منحرف لليمين", "منحرف لليسار"] },
  { key: "overjet", label: "Overjet (mm)" },
  { key: "overbite", label: "Overbite (mm / %)" },
  { key: "deep_bite", label: "Deep Bite", options: YES_NO },
  { key: "anterior_crossbite", label: "Anterior Crossbite", options: YES_NO },
  { key: "shallow_bite", label: "Shallow Bite", options: YES_NO },
  { key: "open_bite", label: "Open Bite", options: YES_NO },
  { key: "crowding", label: "Crowding or Spacing", options: ["Crowding علوي", "Crowding سفلي", "Crowding علوي وسفلي", "Spacing علوي", "Spacing سفلي", "Spacing علوي وسفلي", "لا يوجد"] },
  { key: "buccal", label: "Buccal Segment Relationship" },
  { key: "angle", label: "Angle's Classification", options: ["Class I", "Class II Div 1", "Class II Div 2", "Class II subdivision", "Class III"] },
  { key: "spee", label: "Curve of Spee", options: ["مسطح", "خفيف", "عميق"] },
  { key: "posterior", label: "Posterior Occlusion", options: ["طبيعي", "Crossbite", "Scissor bite"] },
];

export interface OrthoCase {
  id?: string;
  patient_id: string;
  case_date: string;
  complaint: string;
  exam: Record<string, { v?: string; n?: string }>;
  photos: Record<string, string[]>;
  ceph: string;
  diagnosis: string;
  plan: string;
}

export const emptyCase = (patientId: string, date: string): OrthoCase => ({
  patient_id: patientId, case_date: date, complaint: "", exam: {}, photos: {}, ceph: "", diagnosis: "", plan: "",
});

/** Shrinks a photo to at most `max` px on its long side and re-encodes as JPEG. */
export async function compressImage(file: File, max = 1600, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("تعذر ضغط الصورة"))), "image/jpeg", quality));
}
