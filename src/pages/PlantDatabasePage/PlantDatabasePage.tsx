import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { sunlightLabel, type Sunlight } from "../../domain/enums/status";
import type { Plant, PlantCategory } from "../../domain/entities/models";
import { MAX_PLANTS } from "../../domain/services/plantRules";
import { useGardenStore } from "../../stores/gardenStore";

interface PlantFormState {
  name: string;
  category: PlantCategory;
  plantingPeriod: string;
  harvestPeriod: string;
  floweringPeriod: string;
  flowerColor: string;
  plantHeight: string;
  compoundFertilizer: string;
  oilCakeFertilizer: string;
  specializedFertilizer: string;
  topDressing: string;
  watering: string;
  sunlight: Sunlight;
  notes: string;
  imageDataUrl: string;
  imageMimeType: string;
  imageFileSize: number;
  author: string;
}

const PLANT_PHOTO_MAX_SIDE = 520;
const PLANT_PHOTO_QUALITY = 0.68;
const PLANT_PHOTO_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";

const emptyForm: PlantFormState = {
  name: "",
  category: "CROP",
  plantingPeriod: "",
  harvestPeriod: "",
  floweringPeriod: "",
  flowerColor: "",
  plantHeight: "",
  compoundFertilizer: "",
  oilCakeFertilizer: "",
  specializedFertilizer: "",
  topDressing: "",
  watering: "",
  sunlight: "UNKNOWN",
  notes: "",
  imageDataUrl: "",
  imageMimeType: "",
  imageFileSize: 0,
  author: ""
};

const plantCategoryLabel: Record<PlantCategory, string> = {
  CROP: "농작물",
  FLOWER: "화초",
  TREE: "나무"
};

function toForm(plant: Plant): PlantFormState {
  return {
    name: plant.name,
    category: plant.category ?? "CROP",
    plantingPeriod: plant.plantingPeriod,
    harvestPeriod: plant.harvestPeriod,
    floweringPeriod: plant.floweringPeriod ?? "",
    flowerColor: plant.flowerColor ?? "",
    plantHeight: plant.plantHeight ?? "",
    compoundFertilizer: plant.compoundFertilizer,
    oilCakeFertilizer: plant.oilCakeFertilizer,
    specializedFertilizer: plant.specializedFertilizer,
    topDressing: plant.topDressing,
    watering: plant.watering,
    sunlight: plant.sunlight,
    notes: plant.notes,
    imageDataUrl: plant.imageDataUrl ?? "",
    imageMimeType: plant.imageMimeType ?? "",
    imageFileSize: plant.imageFileSize ?? 0,
    author: plant.author || "사용자"
  };
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function compressPlantPhoto(file: File): Promise<Pick<PlantFormState, "imageDataUrl" | "imageMimeType" | "imageFileSize">> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("사진 파일을 읽지 못했습니다."));
      img.src = imageUrl;
    });
    const scale = Math.min(1, PLANT_PHOTO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진 처리 기능을 사용할 수 없습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL("image/jpeg", PLANT_PHOTO_QUALITY);
    return {
      imageDataUrl,
      imageMimeType: "image/jpeg",
      imageFileSize: Math.round((imageDataUrl.length * 3) / 4)
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function PlantDatabasePage() {
  const data = useGardenStore((state) => state.data);
  const addPlant = useGardenStore((state) => state.addPlant);
  const updatePlant = useGardenStore((state) => state.updatePlant);
  const deletePlant = useGardenStore((state) => state.deletePlant);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlantFormState>(emptyForm);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<"idle" | "done">("idle");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim();
    return (data?.plants ?? [])
      .filter((plant) => !keyword || plant.name.includes(keyword) || plant.notes.includes(keyword))
      .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  }, [data, query]);

  const categoryCounts = useMemo(() => {
    const plants = data?.plants ?? [];
    return {
      CROP: plants.filter((plant) => (plant.category ?? "CROP") === "CROP").length,
      FLOWER: plants.filter((plant) => plant.category === "FLOWER").length,
      TREE: plants.filter((plant) => plant.category === "TREE").length
    };
  }, [data]);

  useEffect(() => {
    if (photoUploadStatus !== "done") return;
    const timer = window.setTimeout(() => setPhotoUploadStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [photoUploadStatus]);

  if (!data) return null;
  const editingPlant = editingId ? data.plants.find((plant) => plant.id === editingId) : null;

  function patchForm<K extends keyof PlantFormState>(key: K, value: PlantFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(plant: Plant) {
    setEditingId(plant.id);
    setForm(toForm(plant));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setPhotoInputKey((prev) => prev + 1);
    setPhotoUploadStatus("idle");
    setError("");
  }

  async function onPhotoChange(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const compressed = await compressPlantPhoto(file);
      setForm((prev) => ({ ...prev, ...compressed }));
      setPhotoUploadStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "사진 등록에 실패했습니다.");
      setPhotoUploadStatus("idle");
    } finally {
      setPhotoInputKey((prev) => prev + 1);
    }
  }

  function removePhoto() {
    setForm((prev) => ({ ...prev, imageDataUrl: "", imageMimeType: "", imageFileSize: 0 }));
    setPhotoInputKey((prev) => prev + 1);
    setPhotoUploadStatus("idle");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        if (!window.confirm("식물 정보를 수정하시겠습니까?")) return;
        await updatePlant(editingId, form);
      } else {
        await addPlant(form);
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "식물 DB 저장에 실패했습니다.");
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(searchText.trim());
  }

  function preventEnterSubmit(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.preventDefault();
  }

  async function onDelete(plant: Plant) {
    const confirmed = window.confirm(`${plant.name} 식물을 DB에서 완전삭제하시겠습니까?\n삭제한 식물은 복구할 수 없습니다.`);
    if (!confirmed) return;
    setError("");
    try {
      await deletePlant(plant.id);
      if (editingId === plant.id) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "식물 삭제에 실패했습니다.");
    }
  }

  function plantCards(plants: Plant[]): ReactNode {
    return (
      <section className="card-grid">
        {plants.map((plant) => (
          <article className="card" key={plant.id}>
            <div className="card-title-row plant-card-title-row">
              <strong className="plant-title">
                <span className="plant-category-badge">{plantCategoryLabel[plant.category ?? "CROP"]}</span>
                <span className="plant-name-text">{plant.name}</span>
              </strong>
              <div className="button-row compact">
                <button className="secondary-button" type="button" onClick={() => startEdit(plant)}>
                  <Edit3 size={18} /> 수정
                </button>
                <button className="danger-button" type="button" onClick={() => void onDelete(plant)}>
                  <Trash2 size={18} /> 삭제
                </button>
              </div>
            </div>
            <dl className="info-grid small">
              <dt>파종</dt><dd>{plant.plantingPeriod || "미지정"}</dd>
              <dt>분류</dt><dd>{plantCategoryLabel[plant.category ?? "CROP"]}</dd>
              <dt>수확</dt><dd>{plant.harvestPeriod || "미지정"}</dd>
              <dt>일조</dt><dd>{sunlightLabel[plant.sunlight]}</dd>
              <dt>꽃피는 시기</dt><dd>{plant.floweringPeriod || "미지정"}</dd>
              <dt>꽃 색깔</dt><dd>{plant.flowerColor || "미지정"}</dd>
              <dt>키</dt><dd>{plant.plantHeight || "미지정"}</dd>
              <dt>물주기</dt><dd>{plant.watering || "미지정"}</dd>
              <dt>수정자</dt><dd>{plant.author || "사용자"}</dd>
              <dt>수정일</dt><dd>{plant.updatedAt.slice(0, 10)}</dd>
            </dl>
            <details className="db-details">
              <summary className="secondary-button db-toggle">거름/메모 보기</summary>
              <p>복합비료: {plant.compoundFertilizer || "미지정"}</p>
              <p>유박: {plant.oilCakeFertilizer || "미지정"}</p>
              <p>특화비료: {plant.specializedFertilizer || "미지정"}</p>
              <p>추비: {plant.topDressing || "미지정"}</p>
              <p>기타: {plant.notes || "미지정"}</p>
            </details>
            <details className="db-details">
              <summary className="secondary-button db-toggle">사진보기</summary>
              {plant.imageDataUrl ? (
                <div className="plant-card-photo">
                  <img src={plant.imageDataUrl} alt={`${plant.name} 사진`} />
                  <span>{formatFileSize(plant.imageFileSize)}</span>
                </div>
              ) : (
                <p className="empty-text">등록된 사진이 없습니다.</p>
              )}
            </details>
          </article>
        ))}
      </section>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">식물 기본 DB</p>
          <h1>식물 DB 직접 구축</h1>
          <div className="plant-db-count-row">
            <span className="status-pill">{data.plants.length}/{MAX_PLANTS}개 등록</span>
            <span className="plant-db-category-counts">
              농작물 {categoryCounts.CROP}개, 화초 {categoryCounts.FLOWER}개, 나무 {categoryCounts.TREE}개
            </span>
          </div>
        </div>
      </header>

      <form className="toolbar plant-search-form" onSubmit={onSearch}>
        <input
          value={searchText}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearchText(nextValue);
            if (!nextValue.trim()) setQuery("");
          }}
          placeholder="식물명 검색"
        />
        <button className="primary-button" type="submit">검색</button>
      </form>

      {query && filtered.length === 0 && <p className="empty-text plant-search-result">현재 {query}(이)가 없습니다.</p>}
      {query && filtered.length > 0 && plantCards(filtered)}

      <form className="panel form-stack" onSubmit={onSubmit}>
        <div className="card-title-row">
          <h2>{editingPlant ? `${editingPlant.name} 수정` : "새 식물 등록"}</h2>
          {editingId && (
            <button className="secondary-button" type="button" onClick={cancelEdit}>
              <X size={18} /> 취소
            </button>
          )}
        </div>

        <div className="plant-form-grid">
          <label>
            식물명 *
            <input value={form.name} onKeyDown={preventEnterSubmit} onChange={(event) => patchForm("name", event.target.value)} placeholder="예: 토마토" />
          </label>
          <label>
            식물 분류 *
            <select value={form.category} onChange={(event) => patchForm("category", event.target.value as PlantCategory)}>
              {Object.entries(plantCategoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            최종 수정자 *
            <input value={form.author} onKeyDown={preventEnterSubmit} onChange={(event) => patchForm("author", event.target.value)} placeholder="예: 홍길동" />
          </label>
          <label>
            파종 시기
            <textarea className="compact-textarea" value={form.plantingPeriod} onChange={(event) => patchForm("plantingPeriod", event.target.value)} placeholder="예: 4월~5월" />
          </label>
          <label>
            수확 시기
            <textarea className="compact-textarea" value={form.harvestPeriod} onChange={(event) => patchForm("harvestPeriod", event.target.value)} placeholder="예: 7월~9월" />
          </label>
          <label>
            일조 조건
            <select value={form.sunlight} onChange={(event) => patchForm("sunlight", event.target.value as Sunlight)}>
              {Object.entries(sunlightLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            꽃피는 시기
            <textarea className="compact-textarea" value={form.floweringPeriod} onChange={(event) => patchForm("floweringPeriod", event.target.value)} placeholder="예: 4월~6월" />
          </label>
          <label>
            꽃 색깔
            <textarea className="compact-textarea" value={form.flowerColor} onChange={(event) => patchForm("flowerColor", event.target.value)} placeholder="예: 노랑, 흰색" />
          </label>
          <label>
            키
            <textarea className="compact-textarea" value={form.plantHeight} onChange={(event) => patchForm("plantHeight", event.target.value)} placeholder="예: 30~60cm" />
          </label>
          <label>
            거름/복합비료
            <textarea className="compact-textarea" value={form.compoundFertilizer} onChange={(event) => patchForm("compoundFertilizer", event.target.value)} />
          </label>
          <label>
            거름/유박
            <textarea className="compact-textarea" value={form.oilCakeFertilizer} onChange={(event) => patchForm("oilCakeFertilizer", event.target.value)} />
          </label>
          <label>
            거름/특화비료
            <textarea className="compact-textarea" value={form.specializedFertilizer} onChange={(event) => patchForm("specializedFertilizer", event.target.value)} />
          </label>
          <label>
            추비
            <textarea className="compact-textarea" value={form.topDressing} onChange={(event) => patchForm("topDressing", event.target.value)} />
          </label>
          <label>
            물주기
            <textarea className="compact-textarea" value={form.watering} onChange={(event) => patchForm("watering", event.target.value)} />
          </label>
          <label className="span-2">
            기타
            <textarea value={form.notes} onChange={(event) => patchForm("notes", event.target.value)} />
          </label>
          <div className="span-2 plant-photo-field">
            <label className="plant-photo-upload-label">
              사진 등록
              <span className={`secondary-button plant-photo-upload-button ${photoUploadStatus === "done" ? "upload-done" : ""}`}>
                {photoUploadStatus === "done" ? "등록완료" : "파일/갤러리/구글포토 선택"}
              </span>
              <input key={photoInputKey} className="visually-hidden-file" type="file" accept={PLANT_PHOTO_ACCEPT} onChange={(event) => void onPhotoChange(event.target.files?.[0])} />
            </label>
            <p className="hint">PC에서는 파일을, 휴대폰에서는 갤러리 또는 구글포토를 선택하세요. 사진은 긴 변 {PLANT_PHOTO_MAX_SIDE}px 이하 JPEG로 압축합니다.</p>
            {form.imageDataUrl && (
              <div className="plant-photo-preview-row">
                <img src={form.imageDataUrl} alt={`${form.name || "식물"} 사진 미리보기`} />
                <div>
                  <strong>등록된 사진</strong>
                  <p>{formatFileSize(form.imageFileSize)} · 긴 변 {PLANT_PHOTO_MAX_SIDE}px 이하 JPEG 압축</p>
                  <button className="secondary-button compact-action" type="button" onClick={removePhoto}>사진 삭제</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="primary-button wide" type="submit">
          <Plus size={18} /> {editingId ? "식물 정보 수정" : "식물 DB에 등록"}
        </button>
      </form>

      {!query && data.plants.length > 0 && plantCards(filtered)}
      {!query && data.plants.length === 0 && <p className="empty-text">등록된 식물이 없습니다. 새 식물 등록에서 식물 DB를 직접 만들어 주세요.</p>}
    </div>
  );
}
