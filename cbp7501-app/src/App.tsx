import React, { useState, useRef } from "react";

function Toast({ message, onClose }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-green-700 text-white px-5 py-3 rounded-xl shadow-2xl">
      <span className="text-lg">✓</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-green-200 hover:text-white text-xl leading-none">×</button>
    </div>
  );
}

// ─── PDF 文字抽取（使用 pdfjs-dist）──────────────────────────────────────────
const parsePDFText = async (file: File): Promise<string> => {
  // Load pdfjs from CDN (no npm package required)
  const PDFJS_VERSION = "3.11.174";
  const CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `${CDN_BASE}/pdf.min.js`;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
      `${CDN_BASE}/pdf.worker.min.js`;
  }
  const pdfjsLib = (window as any).pdfjsLib;
  const data = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data }).promise;
  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text;
};

export default function App() {
  const [currentView, setCurrentView] = useState("login");
  const [toast, setToast] = useState(null);
  const [lastSaved, setLastSaved] = useState("2026-05-13 16:30:45");
  const fileRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // ─── Bug #1 Fix：從 PDF 抽取 description 並更新 state ──────────────────────
  const handlePDFUpload = async (file: File) => {
    // Bug #2 Fix：magic bytes 驗證（前5個 bytes 必須是 %PDF-）
    const buf   = await file.slice(0, 5).arrayBuffer();
    const magic = new TextDecoder().decode(buf);
    if (!magic.startsWith("%PDF-")) {
      showToast(`❌「${file.name}」格式錯誤，僅接受有效 PDF 檔案`);
      return false;   // 阻擋上傳
    }
  
    // Bug #1 Fix：解析 PDF 文字，填入 lineItem.description
    try {
      const rawText  = await parsePDFText(file);
      const lines    = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  
      // 找符合 CBP 7501 描述格式的行
      const descLines = lines.filter(l =>
        /S122|9903|OTHER\s+ELEC|LAMPS?|LIGHT|TRANSIT|FITTNG|FITTING|9405/i.test(l)
      );
  
      if (descLines.length > 0) {
        const extracted = descLines.join("\n").trim();
        setLineItem(prev => ({ ...prev, description: extracted }));
        // 若超過 180 字，descWarning 會自動亮起（React re-render）
      }
    } catch (err) {
      // pdfjs 解析失敗 → 結構損毀，阻擋上傳（TC10 Fix）
      console.warn("[PDF Parse] PDF 結構損毀，阻擋上傳", err);
      showToast(`❌「${file.name}」PDF 已損毀，無法讀取`);
      return false;
    }

    return true;   // 通過驗證
  };

  const [lineItem, setLineItem] = useState({
    description: "S122 - EXCLUSION - IN TRANSIT\n9903.03.02\nOTHER ELEC LAMPS & LGHT FITTNG\n9405.41.8440",
    enteredValue: 12129.00, chgs: 4000.00, relationship: "N",
    htsusRate: 3.9, adCvdRate: "", ircRate: "", visaNumber: "",
  });

  const duty         = Math.round(lineItem.enteredValue * (lineItem.htsusRate / 100) * 100) / 100;
  const mpf          = Math.round(Math.min(Math.max(lineItem.enteredValue * 0.003464, 27.75), 528.33) * 100) / 100;
  const hmf          = Math.round(lineItem.enteredValue * 0.00125 * 100) / 100;
  const totalOther   = Math.round((mpf + hmf) * 100) / 100;
  const grandTotal   = Math.round((duty + mpf + hmf) * 100) / 100;
  const descLength   = lineItem.description.length;
  const descWarning  = descLength > 180;

  const handleSave = () => {
    const now = new Date().toLocaleString("zh-TW", { hour12: false }).replace(/\//g, "-");
    setLastSaved(now);
    showToast("儲存成功！Audit Log 已更新。");
  };

  const fmt = (n, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d });

  const CBP7501Header = () => (
    <table className="w-full text-[10px] border-collapse border-2 border-black bg-white font-sans">
      <tbody>
        <tr>
          <td className="border border-black p-1 align-top w-[25%]"><span className="block mb-0.5">1. Filer Code/Entry Number</span><span className="font-bold text-[12px]">BUU-1792771-2</span></td>
          <td className="border border-black p-1 align-top w-[14%]"><span className="block mb-0.5">2. Entry Type</span><span className="font-bold text-[12px]">01 ABI/A</span></td>
          <td className="border border-black p-1 align-top w-[15%]"><span className="block mb-0.5">3. Summary Date</span><span className="font-bold text-[12px]">03/05/26</span></td>
          <td className="border border-black p-1 align-top w-[15%]"><span className="block mb-0.5">4. Surety / 5. Bond</span><span className="font-bold text-[12px]">054 / 8</span></td>
          <td className="border border-black p-1 align-top w-[15%]"><span className="block mb-0.5">6. Port Code</span><span className="font-bold text-[12px]">2704</span></td>
          <td className="border border-black p-1 align-top w-[16%]"><span className="block mb-0.5">7. Entry Date</span><span className="font-bold text-[12px]">02/24/26</span></td>
        </tr>
        <tr>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">8. Importing Carrier</span><span className="font-bold">EVER MAGUS</span></td>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">9. Mode of Transport</span><span className="font-bold">11</span></td>
          <td className="border border-black p-1 align-top"><span className="block mb-0.5">10. Country of Origin</span><span className="font-bold">TW</span></td>
          <td className="border border-black p-1 align-top"><span className="block mb-0.5">11. Import Date</span><span className="font-bold">02/24/26</span></td>
        </tr>
        <tr>
          <td colSpan={3} className="border border-black p-1 align-top"><span className="block mb-0.5">12. B/L or AWB Number</span><span className="font-bold">EGLV 003600099259, ESAN6121CU02</span></td>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">13. Manufacturer ID</span><span className="font-bold">AIFORLIG1920THE</span></td>
          <td className="border border-black p-1 align-top"><span className="block mb-0.5">14. Export Ctry / 15. Date</span><span className="font-bold">TW / 02/04/26</span></td>
        </tr>
        <tr>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">16. IT Number</span><span className="font-bold text-slate-400">—</span></td>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">17. IT Date</span><span className="font-bold text-slate-400">—</span></td>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">18. Missing Docs</span><span className="font-bold text-slate-400">—</span></td>
        </tr>
        <tr>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">19. Foreign Port of Lading</span><span className="font-bold">58309</span></td>
          <td colSpan={4} className="border border-black p-1 align-top"><span className="block mb-0.5">20. U.S. Port of Unlading</span><span className="font-bold">2709</span></td>
        </tr>
        <tr>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">21. Location/G.O. Number</span><span className="font-bold">Y292 Voyage: 005E</span></td>
          <td className="border border-black p-1 align-top"><span className="block mb-0.5">22. Consignee No.</span><span className="font-bold">37-186670800</span></td>
          <td colSpan={2} className="border border-black p-1 align-top"><span className="block mb-0.5">23. Importer Number</span><span className="font-bold">37-186670800</span></td>
          <td className="border border-black p-1 align-top"><span className="block mb-0.5">24. Reference No.</span><span className="font-bold text-slate-400">—</span></td>
        </tr>
        <tr>
          <td colSpan={3} className="border border-black p-1 align-top h-[72px]">
            <span className="block mb-0.5">25. Ultimate Consignee Name and Address</span>
            <span className="font-bold text-[11px] block leading-tight">METEOR ILLUMINATION TECHNOLOGIES<br />Street: 1860 S CARLOS AVE<br />ONTARIO, CA 91761-8005</span>
          </td>
          <td colSpan={3} className="border border-black p-1 align-top h-[72px]">
            <span className="block mb-0.5">26. Importer of Record Name and Address</span>
            <span className="font-bold text-[11px] block leading-tight">METEOR ILLUMINATION TECHNOLOGIES<br />Street: 1860 S CARLOS AVE<br />ONTARIO, CA 91761-8005</span>
          </td>
        </tr>
      </tbody>
    </table>
  );

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  if (currentView === "login") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 font-sans">
        <div className="w-96 bg-white p-8 rounded-xl shadow-md border border-slate-200">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-800">CBP 7501 系統</h1>
            <p className="text-sm text-slate-500 mt-2">Document Composition Engine</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">帳號</label>
              <input type="text" defaultValue="winnie" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
              <input type="password" defaultValue="password" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <button onClick={() => setCurrentView("list")} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded transition-colors mt-4">登入</button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────────────────────────
  if (currentView === "list") {
    return (
      <div className="h-screen w-full bg-slate-50 p-8 font-sans">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">報關文件列表 (Entry Summaries)</h1>
            <button onClick={() => fileRef.current?.click()} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-50 transition-colors">+ 上傳 PDF</button>
            <input
  ref={fileRef}
  type="file"
  accept=".pdf"
  className="hidden"
  onChange={async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast(`「${file.name}」驗證中…`);

    const ok = await handlePDFUpload(file);   // 包含 Bug#2 驗證 + Bug#1 解析
    e.target.value = "";                       // 重置 input 讓同檔案可重新上傳

    if (!ok) return;                           // Bug #2：格式不符直接停止

    showToast(`「${file.name}」解析完成，即將進入編輯頁`);
    setTimeout(() => setCurrentView("edit"), 1200);
  }}
/>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-medium">Entry Number</th>
                  <th className="p-4 font-medium">Importer</th>
                  <th className="p-4 font-medium">Entry Date</th>
                  <th className="p-4 font-medium">更新時間</th>
                  <th className="p-4 font-medium">更新者</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono text-indigo-600 font-medium">BUU-1792771-2</td>
                  <td className="p-4">METEOR ILLUMINATION TECHNOLOGIES</td>
                  <td className="p-4">02/24/26</td>
                  <td className="p-4 text-slate-500 text-xs">{lastSaved}</td>
                  <td className="p-4 text-sm">winnie</td>
                  <td className="p-4"><span className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-xs border border-blue-200">待確認</span></td>
                  <td className="p-4"><button onClick={() => setCurrentView("edit")} className="text-indigo-600 hover:text-indigo-800 font-medium">編輯與預覽</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── PREVIEW ──────────────────────────────────────────────────────────────────
  if (currentView === "preview") {
    const totalsRows = [
      { left: "A. LIQ Code",  mid: "B. Ascertained Duty",  right: "37. Duty",  val: duty.toFixed(2),        border: true },
      { left: "REASON CODE",  mid: "C. Ascertained Tax",   right: "38. Tax",   val: "",                     border: true },
      { left: "",             mid: "D. Ascertained Other", right: "39. Other", val: totalOther.toFixed(2),  border: true },
      { left: "",             mid: "E. Ascertained Total", right: "40. Total", val: grandTotal.toFixed(2),  border: false },
    ];
    return (
      <div className="flex flex-col h-screen w-full bg-slate-400 font-sans">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        <div className="h-16 bg-white border-b border-slate-300 flex items-center justify-between px-6 shadow-sm shrink-0">
          <div>
            <h1 className="font-bold text-slate-800 text-lg">輸出預覽 (Document Preview)</h1>
            <p className="text-xs text-slate-500">確認無誤後點擊匯出，系統將產生實體 PDF。</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCurrentView("edit")} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 rounded transition-colors">返回編輯</button>
            <button onClick={() => { showToast("PDF 已匯出，Audit Log 已更新！"); setTimeout(() => setCurrentView("list"), 1500); }} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded shadow-sm transition-colors">確認匯出 PDF</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-10 px-4">
          <div className="bg-white w-[850px] min-h-[1100px] shadow-2xl mx-auto p-10 text-black flex flex-col">
            <div className="text-center mb-2">
              <div className="text-sm">DEPARTMENT OF HOMELAND SECURITY</div>
              <div className="text-sm">U.S. Customs and Border Protection</div>
              <div className="text-xl font-bold mt-1 tracking-widest">ENTRY SUMMARY</div>
            </div>
            <CBP7501Header />
            <table className="w-full text-xs border-collapse border-2 border-t-0 border-black font-sans">
              <thead>
                <tr className="text-[10px]">
                  <th className="border border-black p-1 text-center w-[5%] font-normal">27.<br />Line<br />No.</th>
                  <th className="border border-black p-1 w-[46%] font-normal">
                    <div className="grid grid-cols-3 text-center text-[9px]">
                      <span>29. A. HTSUS No.<br />B. AD/CVD No.</span>
                      <span>30. A. Gross Wt.<br />B. Manifest Qty.</span>
                      <span>31. Net Qty in<br />HTSUS Units</span>
                    </div>
                    <div className="border-t border-black mt-1 pt-1 text-center">28. Description of Merchandise</div>
                  </th>
                  <th className="border border-black p-1 text-center w-[16%] font-normal">32.<br />A. Entered Value<br />B. CHGS<br />C. Relationship</th>
                  <th className="border border-black p-1 text-center w-[16%] font-normal">33.<br />A. HTSUS Rate<br />B. AD/CVD Rate<br />C. IRC Rate<br />D. Visa Number</th>
                  <th className="border border-black p-1 text-center w-[17%] font-normal">34.<br />Duty and IR Tax<br /><span className="text-[9px]">Dollars Cents</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-r border-black p-1 align-top text-center font-bold">001</td>
                  <td className="border-r border-black p-0 align-top">
                    <div className="grid grid-cols-3 text-center text-[10px] border-b border-black px-1 py-0.5 font-mono">
                      <span>9405.41.8440<br /><span className="text-[9px] text-slate-500">9903.03.02</span></span>
                      <span>1,248 KG</span>
                      <span>65.00 NO</span>
                    </div>
                    <div className="p-1">
                      <div className="text-right text-[9px] mb-1 text-slate-500">65 CTN</div>
                      <div className="font-mono font-bold whitespace-pre text-[11px] leading-tight">{lineItem.description}</div>
                    </div>
                    <div className="border-t border-dashed border-black px-1 py-0.5 text-[9px] text-slate-600 space-y-0.5">
                      <div>499 - Merchandise Processing Fee</div>
                      <div>501 - Harbor Maintenance Fee</div>
                    </div>
                    <div className="border-t border-black px-1 py-0.5 text-[9px] flex justify-between items-center">
                      <span>Totals for Invoice <span className="font-mono font-bold">FSD260120005</span></span>
                      <span>Invoice Value <span className="font-mono font-bold bg-yellow-100">{fmt(lineItem.enteredValue)} USD</span></span>
                    </div>
                  </td>
                  <td className="border-r border-black p-1 align-top text-right text-[11px] space-y-2">
                    <div><span className="bg-yellow-200 font-bold px-1">FREE</span></div>
                    <div>
                      <span className="bg-yellow-200 font-bold">{fmt(lineItem.enteredValue)}</span><br />
                      <span className="text-[9px]">C {fmt(lineItem.chgs)}</span><br />
                      <span className="text-[9px]">{lineItem.relationship}</span>
                    </div>
                    <div className="border-t border-dashed border-black pt-0.5 text-[9px] space-y-0.5">
                      <div>0.3464%</div>
                      <div>0.1250%</div>
                    </div>
                    <div className="border-t border-black pt-0.5 text-[9px] text-center">Exchange<br />1.00000</div>
                  </td>
                  <td className="border-r border-black p-1 align-top text-center text-[11px] space-y-2">
                    <div className="text-[9px] text-slate-400">—</div>
                    <div><span className="bg-yellow-200 font-bold">{lineItem.htsusRate}%</span></div>
                    {lineItem.adCvdRate ? <div className="text-[10px]">{lineItem.adCvdRate}%</div> : null}
                    {lineItem.ircRate ? <div className="text-[10px]">{lineItem.ircRate}%</div> : null}
                    {lineItem.visaNumber ? <div className="text-[10px] font-mono">{lineItem.visaNumber}</div> : null}
                  </td>
                  <td className="p-1 align-top text-right text-[11px] space-y-2">
                    <div className="text-[10px]">$0.00</div>
                    <div><span className="bg-yellow-200 font-bold">{duty.toFixed(2)}</span></div>
                    <div className="border-t border-dashed border-black pt-0.5 text-[9px] space-y-0.5">
                      <div className="bg-yellow-100">{mpf.toFixed(2)}</div>
                      <div className="bg-yellow-100">{hmf.toFixed(2)}</div>
                    </div>
                    <div className="border-t border-black pt-0.5 text-[9px] font-mono bg-yellow-100">{fmt(lineItem.enteredValue)}</div>
                  </td>
                </tr>
                <tr>
                  <td className="border-r border-black h-24"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <div className="w-full border-2 border-black border-t-0 flex text-[11px] font-sans">
              <div className="w-[65%] flex flex-col border-r-2 border-black">
                <div className="flex border-b border-black">
                  <div className="w-[55%] border-r border-black p-1 flex flex-col justify-between min-h-[60px]">
                    <span className="block mb-1">Other Fee Summary <i className="text-[9px]">(for Block 39)</i></span>
                    <div className="flex justify-between font-mono text-[10px]"><span>499 - MPF</span><span className="bg-yellow-200">{mpf.toFixed(2)}</span></div>
                    <div className="flex justify-between font-mono text-[10px]"><span>501 - HMF</span><span className="bg-yellow-200">{hmf.toFixed(2)}</span></div>
                    <div className="mt-1 pt-1 border-t border-black flex justify-between">
                      <span>Total Other Fees</span>
                      <span className="font-mono bg-yellow-200">{totalOther.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="w-[45%] p-1 flex flex-col">
                    <span>35. Total Entered Value</span>
                    <span className="font-bold font-mono text-sm mt-1 bg-yellow-200 self-start">{fmt(lineItem.enteredValue, 0)}</span>
                  </div>
                </div>
                <div className="p-1 flex-1 text-[9px] leading-tight">
                  <div className="border-b border-black pb-1 mb-1 font-bold text-[10px]">36. Declaration of Importer of Record (Owner or Purchaser) or Authorized Agent</div>
                  <p>I declare that I am the <input type="checkbox" readOnly className="mx-1 translate-y-[2px]" /> Importer of record and that the actual owner, purchaser, or consignee for CBP purposes is as shown above, OR <input type="checkbox" checked readOnly onChange={() => {}} className="mx-1 translate-y-[2px]" /> owner or purchaser or agent thereof. I further declare that the merchandise <input type="checkbox" checked readOnly onChange={() => {}} className="mx-1 translate-y-[2px]" /> was obtained pursuant to a purchase or agreement to purchase and that the prices set forth in the invoices are true.</p>
                </div>
              </div>
              <div className="w-[35%] flex flex-col">
                <div className="flex border-b border-black text-center font-bold">
                  <div className="w-[65%] p-1 border-r border-black">CBP USE ONLY</div>
                  <div className="w-[35%] p-1">TOTALS</div>
                </div>
                {totalsRows.map((row, i) => (
                  <div key={i} className={"flex h-8 items-center " + (row.border ? "border-b border-black" : "")}>
                    <div className="w-[20%] px-1 border-r border-black h-full flex items-center text-[9px]">{row.left}</div>
                    <div className="w-[45%] px-1 border-r border-black h-full flex items-center text-[9px]">{row.mid}</div>
                    <div className="w-[35%] px-1 flex flex-col h-full justify-center">
                      <span className="text-[9px]">{row.right}</span>
                      {row.val ? <span className="font-bold font-mono self-end bg-yellow-200">{row.val}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT (default) ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full bg-slate-100 p-4 gap-4 font-sans overflow-hidden">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* ══ 左側面板 ══ */}
      <div className="w-[20%] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-base">檔案資訊</h2>
          <button onClick={() => setCurrentView("list")} className="text-xs text-slate-600 border border-slate-300 px-3 py-1 rounded bg-white font-medium shadow-sm hover:bg-slate-50">返回</button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div><span className="block text-xs font-bold text-slate-400 mb-1">狀態</span><span className="font-bold text-blue-600">待確認</span></div>
          <div><span className="block text-xs font-bold text-slate-400 mb-1">匯入時間</span><span className="font-medium text-slate-800">2026-05-13 10:00:21</span></div>
          <div><span className="block text-xs font-bold text-slate-400 mb-1">更新時間</span><span className="font-medium text-slate-800">{lastSaved}</span></div>
          <div><span className="block text-xs font-bold text-slate-400 mb-1">更新者</span><span className="font-bold text-slate-800">winnie</span></div>
        </div>
        <div className="mx-4 mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
          <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">即時計算</div>
          <div className="flex justify-between"><span className="text-slate-500">Duty (34)</span><span className="font-mono font-bold text-slate-800">{duty.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">MPF (499)</span><span className="font-mono text-slate-600">{mpf.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">HMF (501)</span><span className="font-mono text-slate-600">{hmf.toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-2">
            <span className="font-bold text-slate-700">Grand Total</span>
            <span className="font-mono font-bold text-indigo-600">{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
      {/* ══ 左側面板結束 ══ */}

      {/* ══ 右側面板 ══ */}
      <div className="w-[80%] flex flex-col gap-4 overflow-y-auto pr-2">

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Header (Read-only)</h2>
          <div className="bg-slate-50 p-2 border border-slate-200"><CBP7501Header /></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl flex-1 flex flex-col shadow-sm">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center rounded-t-xl">
            <h2 className="text-sm font-bold text-slate-800">Line Items</h2>
            <span className="text-[11px] bg-amber-50 text-amber-700 px-3 py-1.5 rounded border border-amber-200 font-bold">Yellow Zones Editable</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse border border-slate-200 table-fixed">
              <thead className="text-xs text-slate-600 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="border border-slate-200 py-2 px-2 text-center w-[5%]">27.<br />No.</th>
                  <th className="border border-slate-200 py-2 px-2 text-center w-[38%]">28. Description</th>
                  <th className="border border-slate-200 py-2 px-2 text-center w-[18%]">32. Value / CHGS</th>
                  <th className="border border-slate-200 py-2 px-2 text-center w-[24%]">33. Rates &amp; Identifiers</th>
                  <th className="border border-slate-200 py-2 px-2 text-center w-[15%]">34. Duty/Tax</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 align-top">
                  <td className="border border-slate-200 pt-4 px-2 text-slate-800 font-bold text-sm text-center">001</td>
                  <td className="border border-slate-200 p-2">
                    <textarea
                      maxLength={200}
                      className={"w-full min-h-[160px] p-2 text-xs border rounded focus:ring-2 outline-none resize-none font-mono text-slate-800 whitespace-pre box-border transition-colors " + (descWarning ? "border-red-400 bg-red-50 focus:ring-red-300" : "border-amber-400 bg-amber-50 focus:ring-amber-500")}
                      value={lineItem.description}
                      onChange={(e) => setLineItem({ ...lineItem, description: e.target.value })}
                    />
                    <div className={"flex justify-between text-[10px] mt-1 " + (descWarning ? "text-red-500 font-bold" : "text-slate-400")}>
                      <span>{descWarning ? "⚠ 字數過多，PDF 可能破版" : "建議 180 字以內"}</span>
                      <span>{descLength} / 200</span>
                    </div>
                  </td>
                  <td className="border border-slate-200 p-3 space-y-3">
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-bold">32(A) Value ($)</span>
                      <input type="number" className="w-full p-1.5 text-xs border border-amber-400 bg-amber-50 rounded focus:ring-2 focus:ring-amber-500 outline-none font-mono box-border" value={lineItem.enteredValue} onChange={(e) => setLineItem({ ...lineItem, enteredValue: Number(e.target.value) })} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-bold">32(B) CHGS ($)</span>
                      <input type="number" className="w-full p-1.5 text-xs border border-amber-400 bg-amber-50 rounded focus:ring-2 focus:ring-amber-500 outline-none font-mono box-border" value={lineItem.chgs} onChange={(e) => setLineItem({ ...lineItem, chgs: Number(e.target.value) })} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-bold">32(C) Relationship</span>
                      <input type="text" maxLength={1} className="w-full p-1.5 text-xs border border-amber-400 bg-amber-50 rounded focus:ring-2 focus:ring-amber-500 outline-none font-mono box-border uppercase" value={lineItem.relationship} onChange={(e) => setLineItem({ ...lineItem, relationship: e.target.value.toUpperCase() })} />
                    </div>
                  </td>
                  <td className="border border-slate-200 p-3 space-y-3">
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-bold">33(A) HTSUS Rate</span>
                      <div className="relative">
                        <input type="number" step="0.1" className="w-full p-1.5 pr-6 text-xs border border-amber-400 bg-amber-50 rounded focus:ring-2 focus:ring-amber-500 outline-none font-mono box-border" value={lineItem.htsusRate} onChange={(e) => setLineItem({ ...lineItem, htsusRate: Number(e.target.value) })} />
                        <span className="absolute right-2 top-1.5 text-slate-400 text-xs">%</span>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-bold">33(B) AD/CVD Rate</span>
                      <div className="relative">
                        <input type="number" step="0.1" placeholder="0.0" className="w-full p-1.5 pr-6 text-xs border border-amber-400 bg-amber-50 rounded focus:ring-2 focus:ring-amber-500 outline-none font-mono box-border" value={lineItem.adCvdRate} onChange={(e) => setLineItem({ ...lineItem, adCvdRate: e.target.value })} />
                        <span className="absolute right-2 top-1.5 text-slate-400 text-xs">%</span>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-bold">33(C) IRC Rate</span>
                      <div className="relative">
                        <input type="number" step="0.1" placeholder="0.0" className="w-full p-1.5 pr-6 text-xs border border-amber-400 bg-amber-50 rounded focus:ring-2 focus:ring-amber-500 outline-none font-mono box-border" value={lineItem.ircRate} onChange={(e) => setLineItem({ ...lineItem, ircRate: e.target.value })} />
                        <span className="absolute right-2 top-1.5 text-slate-400 text-xs">%</span>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 mb-0.5 font-bold">33(D) Visa Number</span>
                      <input type="text" placeholder="—" className="w-full p-1.5 text-xs border border-amber-400 bg-amber-50 rounded focus:ring-2 focus:ring-amber-500 outline-none font-mono box-border" value={lineItem.visaNumber} onChange={(e) => setLineItem({ ...lineItem, visaNumber: e.target.value })} />
                    </div>
                  </td>
                  <td className="border border-slate-200 p-3">
                    <span className="block text-[10px] text-slate-500 mb-2 text-center font-bold">Calculated Duty</span>
                    <div className="w-full p-2 text-sm bg-slate-100 border border-slate-300 rounded font-mono text-slate-800 font-bold text-center">{duty.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-400 text-center mt-1">Value x Rate</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex justify-between items-center">
          <p className="text-xs text-slate-400">最後儲存：{lastSaved} by winnie</p>
          <div className="flex gap-3">
            <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-8 rounded transition-colors shadow-sm text-sm">💾 儲存變更</button>
            <button onClick={() => setCurrentView("preview")} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-8 rounded transition-colors shadow-md text-sm">進入排版預覽 →</button>
          </div>
        </div>

      </div>
      {/* ══ 右側面板結束 ══ */}

    </div>
  );
}
