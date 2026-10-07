import React, { useState, useEffect, useRef } from "react";
import { useApp } from "./AppContext";
import { useFullBleedStyle } from "./useWindowSize";

const MAX_IMAGE_DIMENSION = 800;
const IMAGE_JPEG_QUALITY = 0.8;
const UNCATEGORIZED = "غير مصنف";
const toDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toISOStringOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const parseLoyaltyValue = (value, label) => {
  if (value === "" || value === null || value === undefined) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (number > 0 && number < 0.1) || Math.round(number * 100) / 100 !== number) {
    alert(`${label} يجب أن تكون 0 أو قيمة موجبة لا تقل عن 0.1 وبحد أقصى منزلتين عشريتين.`);
    return null;
  }
  return number;
};
const DELIVERY_TYPES = [
  { value: "code", label: "🔑 كود جاهز (جوجل بلاي / ستيم / آيتونز...)" },
  { value: "id_topup", label: "🆔 تعبئة عن طريق آيدي (ببجي / فري فاير...)" },
  { value: "subscription", label: "🔁 اشتراك موقع (نتفليكس / شاهد...)" },
  { value: "store_credit", label: "🪙 بطاقة رصيد المتجر (غير قابلة للسحب)" },
];

const shop2CatalogId = (item) => {
  if (!item || typeof item !== "object") return "";
  return item.id ?? item.big_category_id ?? item.category_id ?? item.sub_category_id ?? item.subcategory_id ?? item.item_id ?? "";
};

const shop2CatalogName = (item) => String(item?.name ?? item?.title ?? item?.label ?? item?.product_name ?? "");

function fileToCompressedBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) {
      reject(new Error("الملف المختار ليس صورة صالحة."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("تعذّر تحميل الصورة."));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width >= height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : IMAGE_JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Products() {
  const { apiUrl, getAuthHeaders, products = [], setProducts, globalBus, triggerGlobalSync, addLog } = useApp();

  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [savingState, setSavingState] = useState("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("الكل");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("منشور");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false); // نافذة إرسال الإيميل
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");

  // حقول الإرسال عبر الإيميل الحقيقي
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("تقرير المنتجات والمخزون الرقمي");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // حقول الإضافة الحقيقية
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [deliveryType, setDeliveryType] = useState("code");
  const [storeCreditAmount, setStoreCreditAmount] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState("0");
  const [loyaltyPrice, setLoyaltyPrice] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [image, setImage] = useState("");
  const [status, setStatus] = useState("منشور");
  const [scheduledDate, setScheduledDate] = useState("");
  const [unpublishDate, setUnpublishDate] = useState("");
  const [manualStock, setManualStock] = useState("");
  const [shop2topupCategoryId, setShop2topupCategoryId] = useState("");
  const [shop2topupItemId, setShop2topupItemId] = useState("");
  const [shop2BigCategoryId, setShop2BigCategoryId] = useState("");
  const [shop2BigCategories, setShop2BigCategories] = useState([]);
  const [shop2Categories, setShop2Categories] = useState([]);
  const [shop2Items, setShop2Items] = useState([]);
  const [shop2CatalogLoading, setShop2CatalogLoading] = useState(false);
  const [shop2GameSearch, setShop2GameSearch] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(3);
  const [maxStockThreshold, setMaxStockThreshold] = useState(50);
  const [newCodeText, setNewCodeText] = useState("");

  // حقول التعديل الحقيقية
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDiscountPrice, setEditDiscountPrice] = useState("");
  const [editLoyaltyPoints, setEditLoyaltyPoints] = useState("0");
  const [editLoyaltyPrice, setEditLoyaltyPrice] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editScheduledDate, setEditScheduledDate] = useState("");
  const [editUnpublishDate, setEditUnpublishDate] = useState("");
  const [editLowStockThreshold, setEditLowStockThreshold] = useState(3);
  const [editMaxStockThreshold, setEditMaxStockThreshold] = useState(50);
  const [editManualStock, setEditManualStock] = useState("");

  const didInit = useRef(false);

  function apiFetch(path, options = {}) {
    return fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
    }).then(async (res) => {
      let data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error((data && data.error) || `فشل الطلب (${res.status})`);
      return data;
    });
  }

  const loadAll = async () => {
    try {
      const [prodData, catData] = await Promise.all([
        apiFetch("/products"),
        apiFetch("/categories"),
      ]);
      setProducts(prodData || []);
      setCategories((catData || []).map((c) => c.name));
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message || "تعذّر الاتصال بالسيرفر");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadAll();
  }, []);

  // المزامنة اللحظية عبر الـ Global Bus State
  useEffect(() => {
    if (globalBus && globalBus.type === "PRODUCT_SYNC") {
      loadAll();
    }
  }, [globalBus]);

  useEffect(() => {
    if (deliveryType !== "id_topup" || shop2BigCategories.length > 0) return;
    setShop2CatalogLoading(true);
    apiFetch("/shop2topup/catalog/big-categories?for_ui=false")
      .then((response) => setShop2BigCategories(response?.data || response?.big_categories || []))
      .catch((err) => alert(`تعذر تحميل كتالوج Shop2Topup: ${err.message}`))
      .finally(() => setShop2CatalogLoading(false));
  }, [deliveryType]);

  const handleShop2BigCategoryChange = async (value) => {
    setShop2BigCategoryId(value);
    setShop2topupCategoryId("");
    setShop2topupItemId("");
    setShop2Categories([]);
    setShop2Items([]);
    if (!value) return;
    setShop2CatalogLoading(true);
    try {
      const response = await apiFetch(`/shop2topup/catalog/categories?bigCategoryId=${encodeURIComponent(value)}&for_ui=false`);
      setShop2Categories(response?.data || response?.categories || []);
    } catch (err) { alert(`تعذر تحميل الفئات: ${err.message}`); }
    finally { setShop2CatalogLoading(false); }
  };

  const handleShop2CategoryChange = async (value) => {
    setShop2topupCategoryId(value);
    setShop2topupItemId("");
    setShop2Items([]);
    if (!value) return;
    setShop2CatalogLoading(true);
    try {
      const response = await apiFetch(`/shop2topup/catalog/subcategories?categoryId=${encodeURIComponent(value)}`);
      setShop2Items(response?.data || response?.subcategories || []);
    } catch (err) { alert(`تعذر تحميل الباقات: ${err.message}`); }
    finally { setShop2CatalogLoading(false); }
  };

  const flashSaving = (msg, syncType = "PRODUCT_SYNC") => {
    setSavingState(msg);
    setTimeout(() => setSavingState(""), 3000);
    if (typeof triggerGlobalSync === "function") {
      triggerGlobalSync({ type: syncType, timestamp: Date.now() });
    }
  };

  const handleImageFileSelect = async (e, isEdit) => {
    const file = e.target.files?.[0];
    if (!file) return;
    isEdit ? setIsUploadingEditImage(true) : setIsUploadingImage(true);
    try {
      const dataUrl = await fileToCompressedBase64(file);
      isEdit ? setEditImage(dataUrl) : setImage(dataUrl);
    } catch (err) {
      alert(err.message);
    } finally {
      isEdit ? setIsUploadingEditImage(false) : setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    try {
      await apiFetch("/categories", { method: "POST", body: JSON.stringify({ name: trimmed }) });
      setCategories((prev) => [...prev, trimmed]);
      setNewCategoryName("");
      flashSaving("✅ تمت إضافة الفئة بنجاح", "CATEGORY_SYNC");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCategory = async (catName, e) => {
    if (e) e.stopPropagation();
    const count = products.filter(p => p.category === catName).length;
    if (!window.confirm(count > 0 ? `سيتم نقل ${count} منتج إلى قسم "${UNCATEGORIZED}". هل تريد الاستمرار؟` : `متأكد من حذف فئة "${catName}"؟`)) return;
    try {
      await apiFetch(`/categories/${encodeURIComponent(catName)}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c !== catName));
      setProducts((prev) => prev.map((p) => (p.category === catName ? { ...p, category: UNCATEGORIZED } : p)));
      flashSaving("🗑️ تم حذف الفئة بنجاح", "CATEGORY_SYNC");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!name || !price) {
      alert("الرجاء إدخال اسم المنتج والسعر الأساسي على الأقل!");
      return;
    }
    const codesArray = deliveryType === "code" || deliveryType === "subscription"
      ? newCodeText.split('\n').filter(c => c.trim() !== '') 
      : [];
    const loyaltyPointsValue = parseLoyaltyValue(loyaltyPoints, "نقاط الولاء");
    const loyaltyPriceValue = parseLoyaltyValue(loyaltyPrice, "سعر النقاط");
    if (loyaltyPointsValue === null || loyaltyPriceValue === null) return;

    const payload = {
      name, description, category: category || UNCATEGORIZED, deliveryType,
      storeCreditAmount: deliveryType === "store_credit" ? (parseFloat(storeCreditAmount) || parseFloat(price)) : undefined,
      loyaltyPoints: loyaltyPointsValue,
      loyaltyPrice: loyaltyPriceValue,
      price: parseFloat(price), discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
      image: image || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300",
      status, scheduledDate: toISOStringOrNull(scheduledDate) || undefined, unpublishDate: toISOStringOrNull(unpublishDate) || undefined,
      lowStockThreshold: parseInt(lowStockThreshold) || 3,
      maxStockThreshold: parseInt(maxStockThreshold) || 50,
      ...(deliveryType === "id_topup" ? { shop2topupCategoryId: Number(shop2topupCategoryId) || undefined, shop2topupItemId: Number(shop2topupItemId) || undefined } : {}),
      codes: codesArray, stock: deliveryType === "id_topup" ? 1 : codesArray.length,
    };

    try {
      const newProduct = await apiFetch("/products", { method: "POST", body: JSON.stringify(payload) });
      setProducts((prev) => [newProduct, ...prev]);
      flashSaving("✅ تم حفظ وإضافة المنتج بنجاح");
      setIsAddModalOpen(false);
      setName(""); setDescription(""); setPrice(""); setDiscountPrice(""); setImage(""); setNewCodeText(""); setManualStock(""); setShop2topupCategoryId(""); setShop2topupItemId(""); setLoyaltyPoints("0"); setLoyaltyPrice(""); setScheduledDate(""); setUnpublishDate("");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartEdit = (prod) => {
    setSelectedProduct(prod);
    setEditName(prod.name || "");
    setEditDescription(prod.description || "");
    setEditCategory(prod.category || "");
    setEditPrice(prod.price || "");
    setEditDiscountPrice(prod.discountPrice || "");
    setEditLoyaltyPoints(prod.loyaltyPoints ?? 0);
    setEditLoyaltyPrice(prod.loyaltyPrice ?? "");
    setEditImage(prod.image || "");
    setEditStatus(prod.status || "منشور");
    setEditScheduledDate(toDateTimeLocal(prod.scheduledDate));
    setEditUnpublishDate(toDateTimeLocal(prod.unpublishDate));
    setEditLowStockThreshold(prod.lowStockThreshold ?? 3);
    setEditMaxStockThreshold(prod.maxStockThreshold ?? 50);
    setEditManualStock(prod.stock ?? 0);
    setShop2topupCategoryId(prod.shop2topupCategoryId ?? "");
    setShop2topupItemId(prod.shop2topupItemId ?? "");
    setIsEditing(true);
    setActiveTab("details");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const loyaltyPointsValue = parseLoyaltyValue(editLoyaltyPoints, "نقاط الولاء");
    const loyaltyPriceValue = parseLoyaltyValue(editLoyaltyPrice, "سعر النقاط");
    if (loyaltyPointsValue === null || loyaltyPriceValue === null) return;
    const payload = {
      name: editName, description: editDescription || "", category: editCategory,
      price: parseFloat(editPrice), discountPrice: editDiscountPrice !== "" ? parseFloat(editDiscountPrice) : null,
      loyaltyPoints: loyaltyPointsValue,
      loyaltyPrice: loyaltyPriceValue,
      image: editImage, status: editStatus,
      scheduledDate: toISOStringOrNull(editScheduledDate), unpublishDate: toISOStringOrNull(editUnpublishDate),
      lowStockThreshold: parseInt(editLowStockThreshold) || 3,
      maxStockThreshold: parseInt(editMaxStockThreshold) || 50,
      ...(selectedProduct.deliveryType === "id_topup" ? { shop2topupCategoryId: Number(shop2topupCategoryId) || undefined, shop2topupItemId: Number(shop2topupItemId) || undefined } : {}),
    };
    if (selectedProduct.deliveryType === "id_topup") payload.stock = 1;

    try {
      const updated = await apiFetch(`/products/${selectedProduct._id}`, { method: "PUT", body: JSON.stringify(payload) });
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setSelectedProduct(updated);
      setIsEditing(false);
      flashSaving("✅ تم تحديث المنتج بنجاح");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTogglePublish = async (prod) => {
    const newStatus = prod.status === "منشور" ? "غير منشور" : "منشور";
    try {
      const updated = await apiFetch(`/products/${prod._id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setSelectedProduct(updated);
      flashSaving(`🔄 تم تغيير الحالة إلى: ${newStatus}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleProductSelection = (id) => setSelectedProductIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);

  const handleBulkStatusUpdate = async () => {
    if (!selectedProductIds.length) return;
    try {
      const updatedRows = await Promise.all(selectedProductIds.map((id) => apiFetch(`/products/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: bulkStatus }) })));
      const updatedById = new Map(updatedRows.map((row) => [row._id, row]));
      setProducts((prev) => prev.map((product) => updatedById.get(product._id) || product));
      if (typeof addLog === 'function') addLog({ action: `🔄 تم تطبيق الحالة (${bulkStatus}) على ${updatedRows.length} منتجات`, type: 'product_bulk_update' });
      setSelectedProductIds([]);
      flashSaving(`✅ تم تحديث ${updatedRows.length} منتجات جماعياً`);
    } catch (err) {
      alert(err.message || 'تعذر تنفيذ العملية الجماعية.');
    }
  };

  const handleDeleteProduct = async (id, prodName) => {
    if (!window.confirm(`هل أنت متأكد من حذف المنتج "${prodName}" نهائياً؟`)) return;
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p._id !== id));
      setSelectedProduct(null);
      setIsEditing(false);
      flashSaving("🗑️ تم حذف المنتج بنجاح");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddCode = async (e) => {
    e.preventDefault();
    if (!newCodeText.trim()) return;
    try {
      const codes = newCodeText.split('\n').map((code) => code.trim()).filter(Boolean);
      const updated = await apiFetch(`/products/${selectedProduct._id}/codes`, { method: "POST", body: JSON.stringify({ codes }) });
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setSelectedProduct(updated);
      setNewCodeText("");
      flashSaving("➕ تمت إضافة الكود بنجاح");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCode = async (codeValue) => {
    try {
      const updated = await apiFetch(`/products/${selectedProduct._id}/codes`, { method: "DELETE", body: JSON.stringify({ code: codeValue }) });
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setSelectedProduct(updated);
      flashSaving("🗑️ تم حذف الكود بنجاح");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateManualStock = async (newStock) => {
    try {
      const updated = await apiFetch(`/products/${selectedProduct._id}/stock`, { method: "PATCH", body: JSON.stringify({ stock: newStock }) });
      setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setSelectedProduct(updated);
      flashSaving("📦 تم تحديث المخزون بنجاح");
    } catch (err) {
      alert(err.message);
    }
  };

  // دالة إرسال الإيميل الحقيقي عبر الباك اند
  const handleSendRealEmail = async (e) => {
    e.preventDefault();
    if (!emailRecipient) {
      alert("الرجاء إدخال بريد المشتلم!");
      return;
    }
    setIsSendingEmail(true);
    try {
      await apiFetch("/send-email", {
        method: "POST",
        body: JSON.stringify({
          to: emailRecipient,
          subject: emailSubject,
          message: emailBody || `تقرير عام لعدد المنتجات: ${products.length} في متجر الكروت الرقمية.`,
        }),
      });
      alert("📧 تم إرسال البريد الإلكتروني بنجاح!");
      setIsEmailModalOpen(false);
      setEmailRecipient("");
      setEmailBody("");
    } catch (err) {
      alert("فشل إرسال الإيميل: " + err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const stockOf = (prod) => (prod.deliveryType === "store_credit" ? "مفتوح" : prod.deliveryType === "id_topup" ? "ديناميكي" : (prod.codes?.length || 0));
  const deliveryLabel = (type) => DELIVERY_TYPES.find((d) => d.value === type)?.label || type;
  const fmtJOD = (n) => `${n} د.أ`;
  const safeProducts = Array.isArray(products) ? products : [];
  const filteredProducts = safeProducts.filter((prod) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = !query || String(prod?.name || '').toLowerCase().includes(query) || String(prod?.category || '').toLowerCase().includes(query);
    const matchesCat = selectedCategoryFilter === "الكل" || prod.category === selectedCategoryFilter;
    const isLow = !["store_credit", "id_topup"].includes(prod.deliveryType) && Number(stockOf(prod)) <= Number(prod.lowStockThreshold ?? 3);
    const matchesStatus = statusFilter === "الكل" || (statusFilter === "منخفض" ? isLow : prod.status === statusFilter);
    return matchesSearch && matchesCat && matchesStatus;
  });
  const lowStockCount = safeProducts.filter((prod) => !["store_credit", "id_topup"].includes(prod.deliveryType) && Number(stockOf(prod)) <= Number(prod.lowStockThreshold ?? 3)).length;
  const unpublishedCount = safeProducts.filter((prod) => prod.status !== "منشور").length;

  if (isLoading) {
    return (
      <div style={glassContainerStyle} dir="rtl">
        <div style={{ textAlign: "center", color: "#38bdf8", padding: "40px" }}>⏳ جاري تحميل لوحة التحكم والبيانات والمزامنة اللحظية...</div>
      </div>
    );
  }

  return (
    <div className="hz-products-section" style={glassContainerStyle} dir="rtl">
      {/* الهيدر العلوي */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: "0 0 5px 0", color: "#f97316", fontSize: "22px", fontWeight: "bold" }}>⚡ لوحة إدارة المنتجات والمخزون الرقمي (متزامنة لحظياً)</h2>
          <p style={{ margin: "0", color: "#94a3b8", fontSize: "13px" }}>
            {loadError && <span style={{ color: "#f87171" }}>⚠️ {loadError}</span>}
            {savingState && <span style={{ color: "#34d399", fontWeight: "bold" }}> {savingState}</span>}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="بحث عن منتج أو قسم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...glassInputStyle, width: "min(360px, 100%)" }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...glassInputStyle, minWidth: "150px" }}>
            <option value="الكل">كل الحالات</option>
            <option value="منشور">منشور</option>
            <option value="غير منشور">غير منشور</option>
            <option value="منخفض">مخزون منخفض</option>
          </select>
          <button onClick={() => setIsEmailModalOpen(true)} style={secondaryButtonStyle}>
            📨 إرسال تقرير إيميل
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", marginBottom: "18px" }}>
        <div style={glassSubContainerStyle}><span style={{ color: "#94a3b8", fontSize: "12px" }}>إجمالي المنتجات</span><strong style={{ color: "#f8fafc", fontSize: "22px" }}>{safeProducts.length}</strong></div>
        <div style={glassSubContainerStyle}><span style={{ color: "#94a3b8", fontSize: "12px" }}>مخزون منخفض</span><strong style={{ color: lowStockCount ? "#f87171" : "#34d399", fontSize: "22px" }}>{lowStockCount}</strong></div>
        <div style={glassSubContainerStyle}><span style={{ color: "#94a3b8", fontSize: "12px" }}>غير منشور</span><strong style={{ color: unpublishedCount ? "#facc15" : "#34d399", fontSize: "22px" }}>{unpublishedCount}</strong></div>
        <div style={glassSubContainerStyle}><span style={{ color: "#94a3b8", fontSize: "12px" }}>نتائج الفلترة</span><strong style={{ color: "#67e8f9", fontSize: "22px" }}>{filteredProducts.length}</strong></div>
      </div>

      {/* قسم إدارة الفئات */}
      <div style={glassSubContainerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <h4 style={{ margin: "0", color: "#38bdf8", fontSize: "15px" }}>🏷️ الأقسام والفئات الرقمية</h4>
          <form onSubmit={handleAddCategory} style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              placeholder="اسم الفئة الجديدة..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ ...glassInputStyle, width: "160px" }}
            />
            <button type="submit" style={secondaryButtonStyle}>+ إضافة فئة</button>
          </form>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => setSelectedCategoryFilter("الكل")} style={filterChipStyle(selectedCategoryFilter === "الكل")}>
            الكل ({products.length})
          </button>
          {categories.map((cat, idx) => {
            const count = products.filter(p => p.category === cat).length;
            return (
              <div key={idx} onClick={() => setSelectedCategoryFilter(cat)} style={filterChipStyle(selectedCategoryFilter === cat)}>
                <span>{cat} ({count})</span>
                <span onClick={(e) => handleDeleteCategory(cat, e)} style={{ color: "#ef4444", marginLeft: "6px", cursor: "pointer", fontSize: "11px" }}>✕</span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedProductIds.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "12px 14px", marginTop: "18px", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "14px", background: "rgba(14, 116, 144, 0.14)" }}>
        <strong style={{ color: "#bae6fd", fontSize: "13px" }}>تم تحديد {selectedProductIds.length} منتجات</strong>
        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={{ ...glassInputStyle, padding: "8px 10px" }}><option value="منشور">منشور</option><option value="غير منشور">غير منشور</option></select>
        <button type="button" onClick={handleBulkStatusUpdate} style={secondaryButtonStyle}>تطبيق الحالة جماعياً</button>
        <button type="button" onClick={() => setSelectedProductIds([])} style={{ ...secondaryButtonStyle, color: "#fca5a5" }}>إلغاء التحديد</button>
      </div>}

      {/* شبكة المنتجات */}
      <div className="hz-products-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: "20px", marginTop: "20px", width: "100%", minWidth: 0, overflow: "visible" }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setIsAddModalOpen(true); setIsEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsAddModalOpen(true); setIsEditing(false); } }}
          style={addProductCardStyle}
          aria-label="إضافة منتج جديد"
        >
          <span style={{ fontSize: "42px", lineHeight: 1 }}>＋</span>
          <strong>إضافة منتج جديد</strong>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>بطاقة أو كود أو بطاقة رصيد</span>
        </div>
        {filteredProducts.map((prod) => {
          const currentStock = stockOf(prod);
          const isLow = prod.deliveryType !== "store_credit" && Number(currentStock) <= (prod.lowStockThreshold ?? 3);
          const hasDiscount = prod.discountPrice && prod.discountPrice < prod.price;
          return (
            <div key={prod._id} onClick={() => { setSelectedProduct(prod); setIsEditing(false); setActiveTab("details"); }} style={glassCardStyle}>
              <input type="checkbox" checked={selectedProductIds.includes(prod._id)} onChange={() => toggleProductSelection(prod._id)} onClick={(event) => event.stopPropagation()} aria-label={`تحديد ${prod.name}`} style={{ alignSelf: "flex-start", accentColor: "#38bdf8" }} />
              <span style={badgeStyle(prod.status === "منشور")}>{prod.status}</span>
              {hasDiscount && <span style={discountBadgeStyle}>🔥 خصم</span>}
              <img src={prod.image || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300"} alt={prod.name} style={{ width: "65px", height: "65px", borderRadius: "10px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", marginTop: "10px" }} />
              <div>
                <h4 style={{ margin: "4px 0", color: "#fff", fontSize: "14px", fontWeight: "bold" }}>{prod.name}</h4>
                <span style={{ fontSize: "11px", color: "#38bdf8" }}>{prod.category}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: "auto", fontSize: "12px", color: "#94a3b8" }}>
                {hasDiscount ? (
                  <span><s style={{ color: "#64748b" }}>{fmtJOD(prod.price)}</s> <strong style={{ color: "#fb923c" }}>{fmtJOD(prod.discountPrice)}</strong></span>
                ) : (
                  <span>السعر: <strong style={{ color: "#10b981" }}>{fmtJOD(prod.price)}</strong></span>
                )}
                <span>{prod.deliveryType === "store_credit" ? "المخزون: " : "الكمية: "}<strong style={{ color: isLow ? "#f87171" : "#facc15" }}>{currentStock}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* نافذة إرسال الإيميل الزجاجية */}
      {isEmailModalOpen && (
        <div className="hz-product-modal-overlay" style={modalOverlayStyle} dir="rtl">
          <div style={modalContentStyle}>
            <button onClick={() => setIsEmailModalOpen(false)} style={closeBtnStyle}>✕</button>
            <h3 style={{ color: "#38bdf8", margin: "0 0 15px 0" }}>📨 إرسال تقرير بريدي حقيقي</h3>
            <form onSubmit={handleSendRealEmail} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input type="email" placeholder="البريد الإلكتروني للمستلم *" value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} style={glassInputStyle} required />
              <input type="text" placeholder="عنوان الرسالة..." value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} style={glassInputStyle} />
              <textarea placeholder="محتوى التقرير أو الملاحظات..." value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={4} style={glassInputStyle} />
              <button type="submit" style={primaryButtonStyle} disabled={isSendingEmail}>
                {isSendingEmail ? "⏳ جاري إرسال الإيميل..." : "إرسال الآن 🚀"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إضافة منتج جديد */}
      {isAddModalOpen && (
        <>
          <div className="hz-product-backdrop" style={{ ...modalOverlayStyle, display: "block", pointerEvents: "none" }} aria-hidden="true" />
          <div className="hz-product-modal" style={{ ...modalContentStyle, position: "fixed", top: "max(8px, env(safe-area-inset-top))", right: 0, bottom: "auto", left: 0, transform: "none", width: "min(760px, calc(100% - 16px))", maxWidth: "calc(100% - 16px)", zIndex: 1101, pointerEvents: "auto" }} dir="rtl">
            <button onClick={() => setIsAddModalOpen(false)} style={closeBtnStyle}>✕</button>
            <h3 style={{ color: "#10b981", margin: "0 0 15px 0" }}>+ إضافة بطاقة أو منتج جديد</h3>
            <form className="hz-product-form" onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input type="text" placeholder="اسم المنتج *" value={name} onChange={(e) => setName(e.target.value)} style={glassInputStyle} required />
              <textarea placeholder="وصف المنتج..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={glassInputStyle} />
              <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} style={glassInputStyle}>
                {DELIVERY_TYPES.map(d => <option key={d.value} value={d.value} style={{ background: "#1e293b" }}>{d.label}</option>)}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={glassInputStyle}>
                <option value="" style={{ background: "#1e293b" }}>— اختر فئة —</option>
                {categories.map((c, i) => <option key={i} value={c} style={{ background: "#1e293b" }}>{c}</option>)}
              </select>
              <div style={{ display: "flex", gap: "10px" }}>
                <input type="number" step="0.01" placeholder="السعر *" value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...glassInputStyle, flex: 1 }} required />
                <input type="number" step="0.01" placeholder="سعر الخصم" value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} style={{ ...glassInputStyle, flex: 1 }} />
              </div>
              <label className="hz-field-label">🎁 نقاط الولاء التي يمنحها هذا المنتج
                <input type="number" min="0" step="0.01" placeholder="مثال: 0.1 أو 2.25 نقطة" value={loyaltyPoints} onChange={(e) => setLoyaltyPoints(e.target.value)} style={glassInputStyle} />
              </label>
              <label className="hz-field-label">⭐ سعر المنتج بنقاط الولاء (اختياري)
                <input type="number" min="0" step="0.01" placeholder="مثال: 0.1 أو 100.25 نقطة — 0 لتعطيل الشراء بالنقاط" value={loyaltyPrice} onChange={(e) => setLoyaltyPrice(e.target.value)} style={glassInputStyle} />
              </label>
              {deliveryType === "store_credit" && <>
                <input type="number" min="0.01" step="0.01" placeholder="قيمة الرصيد داخل البطاقة (دينار)" value={storeCreditAmount} onChange={(e) => setStoreCreditAmount(e.target.value)} style={glassInputStyle} />
                <div style={{ color: "#facc15", fontSize: "12px" }}>هذه البطاقة تُسلّم كوداً للعميل، والرصيد غير قابل للسحب ويُستخدم للشراء داخل المتجر فقط.</div>
              </>}
              {deliveryType === "id_topup" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", padding: "10px", borderRadius: "10px", background: "rgba(14,165,233,0.08)", border: "1px solid rgba(56,189,248,0.25)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <input type="search" value={shop2GameSearch} onChange={(e) => setShop2GameSearch(e.target.value)} placeholder="🔎 ابحث عن اسم اللعبة..." style={glassInputStyle} />
                  <select value={shop2BigCategoryId} onChange={(e) => handleShop2BigCategoryChange(e.target.value)} style={glassInputStyle}>
                    <option value="">{shop2CatalogLoading ? "جاري التحميل..." : "اختر اللعبة"}</option>
                    {shop2BigCategories.filter((item) => !shop2GameSearch.trim() || shop2CatalogName(item).toLowerCase().includes(shop2GameSearch.trim().toLowerCase())).map((item) => { const id = shop2CatalogId(item); return <option key={id} value={id}>{shop2CatalogName(item)} (ID: {id})</option>; })}
                  </select>
                </div>
                <select value={shop2topupCategoryId} onChange={(e) => handleShop2CategoryChange(e.target.value)} style={glassInputStyle} disabled={!shop2BigCategoryId}>
                  <option value="">اختر نوع التعبئة</option>
                  {shop2Categories.map((item) => { const id = shop2CatalogId(item); return <option key={id} value={id}>{shop2CatalogName(item)} (ID: {id})</option>; })}
                </select>
                <select value={shop2topupItemId} onChange={(e) => setShop2topupItemId(e.target.value)} style={glassInputStyle} disabled={!shop2topupCategoryId}>
                  <option value="">اختر الباقة</option>
                  {shop2Items.map((item) => { const id = shop2CatalogId(item); return <option key={id} value={id}>{shop2CatalogName(item)} (ID: {id})</option>; })}
                </select>
                <span style={{ gridColumn: "1 / -1", color: "#7dd3fc", fontSize: "11px" }}>اختر اللعبة ثم نوع التعبئة ثم الباقة؛ التطبيق يضع Category ID وItem ID تلقائياً.</span>
              </div>}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="file" accept="image/*" onChange={(e) => handleImageFileSelect(e, false)} style={{ color: "#94a3b8", fontSize: "12px" }} />
                {isUploadingImage && <span style={{ color: "#38bdf8", fontSize: "11px" }}>⏳ جاري معالجة وضغط الصورة...</span>}
              </div>
              {image && <img src={image} alt="معاينة" style={{ width: "50px", height: "50px", borderRadius: "8px", objectFit: "cover" }} />}
              {deliveryType === "store_credit" ? (
                <div style={{ color: "#facc15", fontSize: "12px", padding: "10px", background: "rgba(250,204,21,0.08)", borderRadius: "8px" }}>🪙 بطاقة رصيد المتجر مفتوحة: لا تحدد مخزوناً ولا تضف أكواداً. يتم توليد كود فريد تلقائياً عند كل شراء.</div>
              ) : deliveryType === "id_topup" ? (
                <div style={{ color: "#7dd3fc", fontSize: "12px", padding: "10px", background: "rgba(14,165,233,0.08)", borderRadius: "8px" }}>📡 التوفر ديناميكي من Shop2Topup — لا تدخل كمية يدوية.</div>
              ) : (
                <textarea placeholder="الأكواد أو الاشتراكات (كل كود في سطر)..." value={newCodeText} onChange={(e) => setNewCodeText(e.target.value)} rows={3} style={{ ...glassInputStyle, fontFamily: "monospace" }} />
              )}
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={glassInputStyle}>
                <option value="منشور" style={{ background: "#1e293b" }}>🟢 منشور فوراً</option>
                <option value="غير منشور" style={{ background: "#1e293b" }}>🔴 غير منشور</option>
              </select>
              <div className="hz-schedule-box">
                <strong>⏰ جدولة النشر التلقائي</strong>
                <label>ينشر في هذا الوقت
                  <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} style={glassInputStyle} />
                </label>
                <label>يلغى النشر في هذا الوقت
                  <input type="datetime-local" value={unpublishDate} onChange={(e) => setUnpublishDate(e.target.value)} style={glassInputStyle} />
                </label>
                <span>اترك الحقل فارغاً إذا لم ترد جدولة العملية.</span>
              </div>
              <button type="submit" style={primaryButtonStyle}>حفظ وإضافة المنتج 🚀</button>
            </form>
          </div>
        </>
      )}

      {/* نافذة تفاصيل وتعديل المنتج */}
      {selectedProduct && (
        <div className="hz-product-modal-overlay" style={modalOverlayStyle} dir="rtl">
          <div style={modalContentStyle}>
            <button onClick={() => { setSelectedProduct(null); setIsEditing(false); }} style={closeBtnStyle}>✕</button>
            {!isEditing ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
                  <img src={selectedProduct.image || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300"} alt={selectedProduct.name} style={{ width: "65px", height: "65px", borderRadius: "10px", objectFit: "cover", border: "1px solid #38bdf8" }} />
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", color: "#fff", fontSize: "16px", fontWeight: "bold" }}>{selectedProduct.name}</h3>
                    <span style={{ fontSize: "12px", color: "#38bdf8" }}>{selectedProduct.category} · {deliveryLabel(selectedProduct.deliveryType)}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", background: "rgba(15,23,42,0.6)", padding: "6px", borderRadius: "10px", marginTop: "12px" }}>
                  <button onClick={() => setActiveTab("details")} style={tabButtonStyle(activeTab === "details", "#facc15")}>📋 التفاصيل</button>
                  <button onClick={() => setActiveTab("stock")} style={tabButtonStyle(activeTab === "stock", "#38bdf8")}>
                    {selectedProduct.deliveryType === "id_topup" ? "📡 التوفر" : selectedProduct.deliveryType === "store_credit" ? "🪙 بطاقات الرصيد" : "🔑 الأكواد"} ({stockOf(selectedProduct)})
                  </button>
                </div>

                {activeTab === "details" ? (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(15,23,42,0.5)", padding: "14px", borderRadius: "10px", fontSize: "13px", marginTop: "12px" }}>
                      {selectedProduct.description && <div style={{ paddingBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" }}>{selectedProduct.description}</div>}
                      <Row label="السعر الأصلي" value={fmtJOD(selectedProduct.price)} color="#10b981" />
                      <Row label="سعر الخصم" value={selectedProduct.discountPrice ? fmtJOD(selectedProduct.discountPrice) : "لا يوجد"} color="#facc15" />
                      <Row label="نقاط الولاء عند الشراء" value={`${Number(selectedProduct.loyaltyPoints || 0)} نقطة`} color="#c084fc" />
                      <Row label="سعر الشراء بالنقاط" value={Number(selectedProduct.loyaltyPrice || 0) > 0 ? `${Number(selectedProduct.loyaltyPrice)} نقطة` : "غير متاح"} color="#e9d5ff" />
                      <Row label="الكمية الحالية" value={stockOf(selectedProduct)} color="#fff" />
                      <Row label="الحالة" value={selectedProduct.status} color={selectedProduct.status === "منشور" ? "#34d399" : "#f87171"} />
                    </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "15px", flexWrap: "wrap" }}>
                      <button onClick={() => handleStartEdit(selectedProduct)} style={actionBtn("#3b82f6")}>تعديل ✏️</button>
                      <button onClick={() => handleTogglePublish(selectedProduct)} style={actionBtn(selectedProduct.status === "منشور" ? "#d97706" : "#059669")}>
                        {selectedProduct.status === "منشور" ? "إلغاء النشر 🛑" : "نشر 🌐"}
                      </button>
                      <button onClick={() => handleDeleteProduct(selectedProduct._id, selectedProduct.name)} style={{ background: "#dc2626", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>حذف 🗑️</button>
                    </div>
                  </>
                ) : selectedProduct.deliveryType === "store_credit" ? (
                  <div style={{ marginTop: "15px", padding: "18px", borderRadius: "12px", background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.35)", color: "#fde68a", textAlign: "center" }}>
                    <strong style={{ display: "block", fontSize: "16px", marginBottom: "8px" }}>🪙 مخزون مفتوح</strong>
                    <span style={{ fontSize: "12px" }}>الكود يولد تلقائياً عند كل عملية شراء، ولا تحتاج لإضافة مخزون أو أكواد يدوياً.</span>
                  </div>
                ) : selectedProduct.deliveryType === "id_topup" ? (
                  <div style={{ marginTop: "15px", padding: "18px", borderRadius: "12px", background: "rgba(14,165,233,0.08)", border: "1px solid rgba(56,189,248,0.35)", color: "#bae6fd", textAlign: "center" }}>
                    <strong style={{ display: "block", fontSize: "16px", marginBottom: "8px" }}>📡 توفر ديناميكي</strong>
                    <span style={{ fontSize: "12px" }}>التوفر والسعر يتم التحقق منهما مباشرة من Shop2Topup عند الشراء. لا يوجد مخزون يدوي.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
                    <form onSubmit={handleAddCode} style={{ display: "flex", gap: "8px" }}>
                      <textarea
                        rows={2}
                        placeholder={selectedProduct.deliveryType === "store_credit" ? "أضف كود بطاقة رصيد..." : "أضف كود جديد..."}
                        value={newCodeText}
                        onChange={(e) => setNewCodeText(e.target.value)}
                        style={{ flex: 1, ...glassInputStyle, fontFamily: "monospace", resize: "vertical" }}
                      />
                      <button type="submit" style={secondaryButtonStyle}>+ إضافة</button>
                    </form>
                    <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "rgba(15,23,42,0.5)", padding: "10px", borderRadius: "8px" }}>
                      {(!selectedProduct.codes || selectedProduct.codes.length === 0) ? (
                        <span style={{ color: "#64748b", fontSize: "12px", textAlign: "center", padding: "15px" }}>لا توجد أكواد مضافة.</span>
                      ) : (
                        selectedProduct.codes.map((code, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(30,41,59,0.7)", padding: "8px 12px", borderRadius: "6px" }}>
                            <span style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "13px" }}>{code}</span>
                            <button onClick={() => handleDeleteCode(code)} style={{ background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", fontWeight: "bold" }}>✕</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <form className="hz-product-form" onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3 style={{ margin: "0 0 5px 0", color: "#38bdf8", fontSize: "16px", fontWeight: "bold" }}>تعديل تفاصيل المنتج</h3>
                <input type="text" placeholder="اسم المنتج..." value={editName} onChange={(e) => setEditName(e.target.value)} style={glassInputStyle} required />
                <textarea placeholder="وصف المنتج..." value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} style={glassInputStyle} />
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={glassInputStyle}>
                  {categories.map((c, i) => <option key={i} value={c} style={{ background: "#1e293b" }}>{c}</option>)}
                </select>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <input type="number" step="0.01" placeholder="السعر..." value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ ...glassInputStyle, flex: 1 }} required />
                  <input type="number" step="0.01" placeholder="سعر الخصم..." value={editDiscountPrice} onChange={(e) => setEditDiscountPrice(e.target.value)} style={{ ...glassInputStyle, flex: 1 }} />
                </div>
                <label className="hz-field-label">🎁 نقاط الولاء التي يمنحها هذا المنتج
                  <input type="number" min="0" step="0.01" placeholder="مثال: 0.1 أو 2.25 نقطة" value={editLoyaltyPoints} onChange={(e) => setEditLoyaltyPoints(e.target.value)} style={glassInputStyle} />
                </label>
                <label className="hz-field-label">⭐ سعر المنتج بنقاط الولاء (اختياري)
                  <input type="number" min="0" step="0.01" placeholder="0 = غير متاح بالنقاط، أو قيمة حتى منزلتين" value={editLoyaltyPrice} onChange={(e) => setEditLoyaltyPrice(e.target.value)} style={glassInputStyle} />
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="file" accept="image/*" onChange={(e) => handleImageFileSelect(e, true)} style={{ color: "#94a3b8", fontSize: "12px" }} />
                  {isUploadingEditImage && <span style={{ color: "#38bdf8", fontSize: "11px" }}>⏳ جاري المعالجة...</span>}
                </div>
                {editImage && <img src={editImage} alt="معاينة" style={{ width: "50px", height: "50px", borderRadius: "8px", objectFit: "cover" }} />}
                {selectedProduct.deliveryType === "id_topup" && (
                  <>
                    <div style={{ color: "#7dd3fc", fontSize: "12px", padding: "10px", background: "rgba(14,165,233,0.08)", borderRadius: "8px" }}>📡 التوفر ديناميكي من Shop2Topup — لا تدخل كمية يدوية.</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "10px", borderRadius: "10px", background: "rgba(14,165,233,0.08)" }}>
                      <input type="number" placeholder="Shop2Topup Category ID" value={shop2topupCategoryId} onChange={(e) => setShop2topupCategoryId(e.target.value)} style={glassInputStyle} />
                      <input type="number" placeholder="Shop2Topup Item ID" value={shop2topupItemId} onChange={(e) => setShop2topupItemId(e.target.value)} style={glassInputStyle} />
                    </div>
                  </>
                )}
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={glassInputStyle}>
                  <option value="منشور" style={{ background: "#1e293b" }}>🟢 منشور</option>
                  <option value="غير منشور" style={{ background: "#1e293b" }}>🔴 غير منشور</option>
                </select>
                <div className="hz-schedule-box">
                  <strong>⏰ جدولة النشر التلقائي</strong>
                  <label>ينشر في هذا الوقت
                    <input type="datetime-local" value={editScheduledDate} onChange={(e) => setEditScheduledDate(e.target.value)} style={glassInputStyle} />
                  </label>
                  <label>يلغى النشر في هذا الوقت
                    <input type="datetime-local" value={editUnpublishDate} onChange={(e) => setEditUnpublishDate(e.target.value)} style={glassInputStyle} />
                  </label>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button type="submit" style={{ flex: 1, ...primaryButtonStyle }}>حفظ التعديلات ✅</button>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, ...secondaryButtonStyle, background: "#334155" }}>إلغاء ✕</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// 🎨 التصميم الزجاجي الفاخر (Glassmorphism Styles)
// ------------------------------------------------------------------
const glassContainerStyle = {
  background: "rgba(15, 23, 42, 0.78)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  padding: "clamp(12px, 3vw, 30px)",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "none",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "visible",
  color: "#fff",
  fontFamily: "Tajawal, sans-serif",
  boxShadow: "0 25px 50px -12px rgba(2, 6, 23, 0.65), 0 0 30px rgba(14, 165, 233, 0.08)"
};

const glassSubContainerStyle = {
  background: "rgba(30, 41, 59, 0.45)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  padding: "18px",
  borderRadius: "16px",
  marginTop: "20px"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  paddingBottom: "15px",
  flexWrap: "wrap",
  gap: "15px"
};

const glassInputStyle = {
  background: "rgba(15, 23, 42, 0.65)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "10px 14px",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box"
};

const primaryButtonStyle = {
  background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(249, 115, 22, 0.3)"
};

const secondaryButtonStyle = {
  background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold"
};

const glassCardStyle = {
  background: "rgba(30, 41, 59, 0.55)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "10px",
  cursor: "pointer",
  position: "relative",
  boxShadow: "0 8px 32px 0 rgba(2, 6, 23, 0.4)"
};

const addProductCardStyle = {
  ...glassCardStyle,
  minHeight: "220px",
  justifyContent: "center",
  border: "1px dashed rgba(56, 189, 248, 0.65)",
  background: "linear-gradient(145deg, rgba(14, 116, 144, 0.28), rgba(30, 41, 59, 0.5))",
  color: "#7dd3fc",
  cursor: "pointer",
  transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
};

const badgeStyle = (isPublished) => ({
  position: "absolute", top: "10px", left: "10px", fontSize: "10px", padding: "2px 8px", borderRadius: "10px",
  background: isPublished ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
  color: isPublished ? "#34d399" : "#f87171", border: "1px solid", borderColor: isPublished ? "#059669" : "#dc2626"
});

const discountBadgeStyle = {
  position: "absolute", top: "10px", right: "10px", fontSize: "10px", padding: "2px 8px", borderRadius: "10px",
  background: "rgba(249, 115, 22, 0.2)", color: "#fb923c", border: "1px solid #ea580c", fontWeight: "bold"
};

const modalOverlayStyle = {
  position: "fixed", inset: 0, width: "100%", height: "100dvh", minHeight: 0,
  background: "rgba(2, 6, 23, 0.86)", backdropFilter: "blur(12px)",
  display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1100, padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))", boxSizing: "border-box", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", touchAction: "pan-y", pointerEvents: "auto", WebkitOverflowScrolling: "touch"
};

const modalContentStyle = {
  background: "linear-gradient(145deg, rgba(23, 37, 84, 0.97), rgba(15, 23, 42, 0.97))", backdropFilter: "blur(20px)",
  border: "1px solid rgba(56, 189, 248, 0.32)", borderRadius: "22px",
  padding: "clamp(16px, 2.5vw, 28px)", width: "min(100%, 760px)", maxWidth: "760px", maxHeight: "calc(100dvh - max(24px, env(safe-area-inset-top) + env(safe-area-inset-bottom) + 24px))",
  overflowY: "auto", overflowX: "hidden", position: "relative", boxSizing: "border-box", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", boxShadow: "0 25px 50px -12px rgba(2, 6, 23, 0.72), 0 0 40px rgba(14, 165, 233, 0.12)", margin: "auto", flex: "0 1 auto", minHeight: 0
};

const closeBtnStyle = {
  position: "absolute", top: "15px", left: "15px", background: "rgba(56,189,248,0.16)",
  color: "#bae6fd", border: "1px solid rgba(56,189,248,0.35)", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontWeight: "bold"
};

const filterChipStyle = (BusActive) => ({
  background: BusActive ? "linear-gradient(135deg, #facc15 0%, #eab308 100%)" : "rgba(15, 23, 42, 0.6)",
  color: BusActive ? "#0f172a" : "#94a3b8", border: "1px solid rgba(255, 255, 255, 0.1)",
  padding: "6px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center"
});

const tabButtonStyle = (active, activeColor) => ({
  flex: 1, background: active ? "rgba(30, 41, 59, 0.9)" : "transparent",
  color: active ? activeColor : "#94a3b8", border: "none", padding: "8px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "12px"
});

const actionBtn = (bg) => ({
  flex: "1 1 120px", minWidth: 0, background: bg, color: "#fff", border: "none", padding: "10px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "12px"
});

const stockBtnStyle = {
  background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", width: "36px", height: "36px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold"
};

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
      <span>{label}:</span>
      <span style={{ color, fontWeight: "bold" }}>{value}</span>
    </div>
  );
}
