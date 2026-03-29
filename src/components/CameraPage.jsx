import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon, ic, RoomIcon } from "../utils/icons.jsx";
import { PLAN_VIDEO_LIMIT_SECS } from "../utils/constants.js";
import { uid, today , parseTagInput, ROLE_META
} from "../utils/helpers.js";

export function CameraPage({ project, defaultRoom, onSave, onClose, settings }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const flashRef     = useRef(null);
  const streamRef    = useRef(null);
  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);
  const recTimerRef  = useRef(null);

  const [camState,    setCamState]    = useState("starting");
  const [showRotateTip, setShowRotateTip] = useState(() => !localStorage.getItem("kc_rotate_tip_seen"));
  useEffect(() => {
    if (!showRotateTip) return;
    const t = setTimeout(() => { setShowRotateTip(false); localStorage.setItem("kc_rotate_tip_seen","1"); }, 5000);
    return () => clearTimeout(t);
  }, [showRotateTip]);
  const [facing,      setFacing]      = useState("environment");
  const [zoom,        setZoom]        = useState(1);
  const [timerSec,    setTimerSec]    = useState(0);
  const [countdown,   setCountdown]   = useState(null);
  const [firing,      setFiring]      = useState(false);
  const [gridOn,      setGridOn]      = useState(true);
  const [reviewImg,   setReviewImg]   = useState(null);
  const [session,     setSession]     = useState([]);
  const [gps,         setGps]         = useState(null);
  const [gpsLabel,    setGpsLabel]    = useState("Locatingâ¦");
  const [selRoom,     setSelRoom]     = useState(defaultRoom || (project?.rooms?.[0]?.name) || "General");
  const [photoName,   setPhotoName]   = useState("");
  const [roomMenuOpen,setRoomMenuOpen]= useState(false);
  const [batchRoom,   setBatchRoom]   = useState(defaultRoom || (project?.rooms?.[0]?.name) || "General");
  const [batchFloor,  setBatchFloor]  = useState("");
  const [batchNotes,  setBatchNotes]  = useState("");
  const [batchTagsInput, setBatchTagsInput] = useState("");
  const [showApplyAll, setShowApplyAll] = useState(false);

  // Flash mode state ("off" | "on")
  const [flashMode,      setFlashMode]      = useState("off");
  const [torchOn,        setTorchOn]        = useState(false);   // kept for compat, unused
  const [torchSupported, setTorchSupported] = useState(false);


  // Video mode state
  const [mode,        setMode]        = useState("photo");  // "photo" | "video"
  const [recState,    setRecState]    = useState("idle");   // "idle" | "recording" | "review"
  const [recSeconds,  setRecSeconds]  = useState(0);
  const [reviewVideo, setReviewVideo] = useState(null);     // object URL
  const [videoName,   setVideoName]   = useState("");

  const MAX_REC = PLAN_VIDEO_LIMIT_SECS[settings?.plan || "base"] || 90;
  const shouldSaveToDevice = !!settings?.saveToCameraRoll;

  useEffect(() => {
    if (!navigator.geolocation) { setGpsLabel("GPS unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      p => { const la = p.coords.latitude.toFixed(5), lo = p.coords.longitude.toFixed(5); setGps({ lat: la, lng: lo }); setGpsLabel(`${la}, ${lo}`); },
      () => setGpsLabel("Location denied"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (session.length === 0) {
      setBatchRoom(selRoom);
      setBatchFloor("");
      setBatchNotes("");
      setBatchTagsInput("");
      setShowApplyAll(false);
    }
  }, [session.length, selRoom]);

  const triggerDeviceDownload = useCallback((href, filename) => {
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const startStream = useCallback(async (face) => {
    setCamState("starting");
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const photoResMap = {
        low:      { width: { ideal: 1280 }, height: { ideal: 720  } },
        moderate: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        high:     { width: { ideal: 3840 }, height: { ideal: 2160 } },
      };
      const videoResMap = {
        low:      { width: { ideal: 1280 }, height: { ideal: 720  }, frameRate: { ideal: 24, max: 30 } },
        moderate: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } },
        high:     { width: { ideal: 2560 }, height: { ideal: 1440 }, frameRate: { ideal: 30, max: 60 } },
      };
      const streamRes = mode === "video"
        ? (videoResMap[settings?.videoQuality] ?? videoResMap.moderate)
        : (photoResMap[settings?.photoQuality] ?? photoResMap.moderate);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, ...streamRes },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        const vid = videoRef.current;
        vid.srcObject = stream;
        vid.muted = true;
        vid.playsInline = true;
        // Wait for enough data to display a frame before marking live
        await new Promise((resolve) => {
          const onReady = () => { vid.removeEventListener("canplay", onReady); resolve(); };
          vid.addEventListener("canplay", onReady);
          vid.play().catch(() => {});
          // Safety timeout â show stream after 2s even if canplay never fires
          setTimeout(resolve, 2000);
        });
      }
      // Reset flash when switching cameras
      setFlashMode("off");
      // Pre-warm ImageCapture so fillLightMode:'flash' is ready on first shot
      try {
        const t = stream.getVideoTracks()[0];
        if (t && typeof ImageCapture !== "undefined") {
          const ic = new ImageCapture(t);
          ic.getPhotoCapabilities().catch(() => {});
        }
      } catch { /* ignore */ }
      setCamState("live");
    } catch (e) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") setCamState("denied");
      else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") setCamState("nodevice");
      else setCamState("error");
    }
  }, [mode, settings?.photoQuality, settings?.videoQuality]);

  useEffect(() => {
    startStream(facing);
  }, [startStream, facing]);

  useEffect(() => { return () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  }; }, []);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities?.();
    if (caps?.zoom) track.applyConstraints({ advanced: [{ zoom }] }).catch(() => {});
  }, [zoom]);

  // toggleFlash: cycles flashMode between off/on
  const toggleTorch = useCallback(() => {
    setFlashMode(m => m === "off" ? "on" : "off");
  }, []);

  // ââ Photo capture ââ
  const doSnap = useCallback(async () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    setFiring(true);

    // Screen flash overlay
    if (flashRef.current) { flashRef.current.classList.add("on"); setTimeout(() => flashRef.current?.classList.remove("on"), 140); }

    const qualityMap = { low: 0.5, moderate: 0.85, high: 0.97 };
    const jpegQuality = qualityMap[settings?.photoQuality] ?? 0.88;
    const resMap = { low: 1920, moderate: 2560, high: 3840 };
    const maxRes = resMap[settings?.photoQuality] ?? 2560;

    const drawOverlay = (cvs) => {
      const ctx = cvs.getContext("2d");
      ctx.fillStyle = "rgba(0,0,0,0.52)";
      ctx.fillRect(10, cvs.height - 58, 480, 46);
      ctx.fillStyle = "white"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(`${project?.title || "Jobsite"} â ${selRoom}  â¢  ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} ${new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:(settings?.timeFormat!=="24hr")})}`, 18, cvs.height - 37);
      ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "12px sans-serif";
      ctx.fillText(gps ? `GPS: ${gps.lat}, ${gps.lng}` : "GPS: unavailable", 18, cvs.height - 17);
    };

    // ââ ImageCapture path (Chrome Android â supports fillLightMode:'flash') ââ
    const track = streamRef.current?.getVideoTracks()[0];
    if (flashMode === "on" && facing === "environment") {
      if (track && typeof ImageCapture !== "undefined") {
        try {
          const imageCapture = new ImageCapture(track);
          // Call getPhotoCapabilities first â this warms up the ImageCapture API
          // and makes fillLightMode:'flash' fire reliably on Chrome Android
          await imageCapture.getPhotoCapabilities().catch(() => {});
          const blob = await imageCapture.takePhoto({ fillLightMode: "flash" });
          const orientation = await getExifOrientation(blob);
          const bmp = await createImageBitmap(blob);
          // Draw to a temp canvas with orientation applied, then scale down
          const tmpC = document.createElement("canvas");
          const tmpImg = { width: bmp.width, height: bmp.height, naturalWidth: bmp.width, naturalHeight: bmp.height };
          // Use OffscreenCanvas trick: draw bmp as image source
          const orientC = document.createElement("canvas");
          drawImageWithOrientation(orientC, bmp, orientation);
          const vw = orientC.width, vh = orientC.height;
          const scale = Math.min(maxRes / vw, maxRes / vh, 1);
          canvas.width  = Math.round(vw * scale);
          canvas.height = Math.round(vh * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(orientC, 0, 0, canvas.width, canvas.height);
          drawOverlay(canvas);
          setReviewImg(canvas.toDataURL("image/jpeg", jpegQuality));
          setTimeout(() => setFiring(false), 200);
          return;
        } catch (e) {
          console.warn("[KrakenCam] ImageCapture flash failed, falling back:", e?.message);
          // fall through to canvas path below
        }
      }
    }

    // ââ Canvas path (no flash / fallback) ââ
    const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
    const scale = Math.min(maxRes / vw, maxRes / vh, 1);
    const sw = Math.round(vw * scale);
    const sh = Math.round(vh * scale);

    // Step 1: draw video to a temp canvas at scaled size
    const tmp = document.createElement("canvas");
    tmp.width = sw; tmp.height = sh;
    const tmpCtx = tmp.getContext("2d");
    if (facing === "user") { tmpCtx.translate(sw, 0); tmpCtx.scale(-1, 1); }
    tmpCtx.drawImage(video, 0, 0, sw, sh);
    tmpCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Use the video element's rendered bounding rect â most reliable signal on
    // Android/iOS when the page itself is portrait-locked. If the video element
    // is rendering wider than tall, the user is holding the phone landscape even
    // though all orientation APIs return 0 and the stream is still portrait pixels.
    const rect = video.getBoundingClientRect();
    const viewIsLandscape  = rect.width > rect.height;
    const streamIsPortrait = vh > vw;
    const needsRotation    = viewIsLandscape && streamIsPortrait;

    if (needsRotation) {
      canvas.width  = sh;
      canvas.height = sw;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.translate(sh, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    } else {
      canvas.width  = sw;
      canvas.height = sh;
      canvas.getContext("2d").drawImage(tmp, 0, 0);
    }

    drawOverlay(canvas);
    setReviewImg(canvas.toDataURL("image/jpeg", jpegQuality));
    setTimeout(() => setFiring(false), 200);
  }, [facing, gps, selRoom, project, settings?.photoQuality, flashMode]);

  const handleShutter = () => {
    if (timerSec === 0) { doSnap(); return; }
    let c = timerSec; setCountdown(c);
    const iv = setInterval(() => { c--; if (c <= 0) { clearInterval(iv); setCountdown(null); doSnap(); } else setCountdown(c); }, 1000);
  };

  const acceptPhoto = () => {
    const name = photoName.trim() || `${selRoom} â ${new Date().toLocaleTimeString()}`;
    if (shouldSaveToDevice && reviewImg) triggerDeviceDownload(reviewImg, `KrakenCam_${name.replace(/[^a-z0-9]/gi,"_")}.jpg`);
    setSession(prev => [...prev, { id: uid(), dataUrl: reviewImg, room: selRoom, name, date: today(), tags: ["live capture"], gps }]);
    setReviewImg(null); setPhotoName("");
  };

  // ââ Video recording ââ
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";
    const videoBitsMap = { low: 1_000_000, moderate: 2_500_000, high: 5_000_000 };
    const videoBitsPerSecond = videoBitsMap[settings?.videoQuality] ?? 2_500_000;
    const rec = new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond });
    rec.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      setReviewVideo({ url, blob, mimeType });
      setRecState("review");
    };
    rec.start(100);
    mediaRecRef.current = rec;
    setRecSeconds(0);
    setRecState("recording");
    recTimerRef.current = setInterval(() => {
      setRecSeconds(s => {
        if (s + 1 >= MAX_REC) { stopRecording(); return MAX_REC; }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
  };

  const handleVideoShutter = () => {
    if (recState === "idle")      startRecording();
    else if (recState === "recording") stopRecording();
  };

  const acceptVideo = () => {
    if (!reviewVideo) return;
    const name = videoName.trim() || `${selRoom} â Video ${new Date().toLocaleTimeString()}`;
    if (shouldSaveToDevice) triggerDeviceDownload(reviewVideo.url, `KrakenCam_${name.replace(/[^a-z0-9]/gi,"_")}.webm`);
    // Create a fresh persistent object URL for the session item (do NOT revoke the review URL
    // until after the session item has its own URL, otherwise playback breaks)
    const persistentUrl = URL.createObjectURL(reviewVideo.blob);
    setSession(prev => [...prev, {
      id: uid(),
      dataUrl: persistentUrl,
      isVideo: true,
      mimeType: reviewVideo.mimeType,
      room: selRoom, name, date: today(),
      tags: ["video", "live capture"], gps,
      duration: recSeconds,
      _blob: reviewVideo.blob, // keep ref so handleCameraSave can upload to Supabase
    }]);
    // Now safe to revoke the review URL since the session item has its own
    URL.revokeObjectURL(reviewVideo.url);
    setReviewVideo(null); setVideoName(""); setRecSeconds(0); setRecState("idle");
  };

  const discardVideo = () => {
    if (reviewVideo) URL.revokeObjectURL(reviewVideo.url);
    setReviewVideo(null); setRecSeconds(0); setRecState("idle");
  };

  const flipCam = () => { setFacing(prev => prev === "environment" ? "user" : "environment"); };
  const cycleTimer = () => setTimerSec(t => t === 0 ? 3 : t === 3 ? 10 : 0);

  const roomList = project?.rooms?.map(r => r.name) || ["General"];
  const floorOptions = ["Basement","Lower Level","Main Floor","Second Floor","Third Floor","Attic","Roof","Exterior"];
  const batchTags = parseTagInput(batchTagsInput);
  const finalizeSessionSave = (useBatchOverrides = false) => {
    onSave(session.map(item => ({
      ...item,
      room: useBatchOverrides ? (batchRoom || item.room || selRoom) : item.room,
      floor: useBatchOverrides ? (batchFloor || item.floor || "") : (item.floor || ""),
      notes: useBatchOverrides ? (batchNotes.trim() || item.notes || "") : (item.notes || ""),
      tags: useBatchOverrides ? Array.from(new Set([...(item.tags || []), ...batchTags])) : (item.tags || []),
    })));
  };

  const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const recPct  = (recSeconds / MAX_REC) * 100;

  // Desktop without a camera â show friendly message instead of dark screen
  if (!navigator.mediaDevices?.getUserMedia) return (
    <div className="cam-page"><div className="cam-error">
      <div className="cam-error-icon"><Icon d={ic.camera} size={32} stroke="var(--accent)" /></div>
      <div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Camera Not Available</div>
      <div style={{ fontSize:13,color:"var(--text2)",maxWidth:320,textAlign:"center",lineHeight:1.6 }}>
        Camera capture requires a device with a camera. On desktop, you can still upload photos using the <strong>Upload Photos</strong> button on the Photos tab.
      </div>
      <button className="btn btn-secondary" onClick={onClose} style={{ marginTop:8 }}>Go Back</button>
    </div></div>
  );

  if (camState === "denied") return (
    <div className="cam-page"><div className="cam-error" style={{ maxWidth:420,margin:"0 auto" }}>
      <div className="cam-error-icon"><Icon d={ic.alert} size={32} stroke="var(--accent)" /></div>
      <div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Camera Access Blocked</div>
      <div style={{ fontSize:13,color:"var(--text2)",lineHeight:1.7,textAlign:"left",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",width:"100%",maxWidth:360 }}>
        <div style={{ fontWeight:700,marginBottom:8,color:"var(--text)",fontSize:12.5 }}>To fix this:</div>
        <div style={{ marginBottom:6 }}>
          <strong style={{ color:"var(--text)" }}>Brave:</strong> Click the ð¦ Shields icon â turn off <em>Device recognition blocking</em>, or click ð â Site settings â Camera â <strong>Allow</strong>
        </div>
        <div style={{ marginBottom:6 }}>
          <strong style={{ color:"var(--text)" }}>Chrome / Edge:</strong> Click the ð lock icon in the address bar â <em>Site settings</em> â Camera â <strong>Allow</strong>
        </div>
        <div style={{ marginBottom:6 }}>
          <strong style={{ color:"var(--text)" }}>Safari (iOS):</strong> Settings app â Safari â Camera â Allow
        </div>
        <div>
          <strong style={{ color:"var(--text)" }}>Firefox:</strong> Click the ð lock icon â Camera permission â <strong>Allow</strong>
        </div>
        <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)",fontSize:11.5,color:"var(--text3)" }}>
          After changing permissions, refresh the page and try again.
        </div>
      </div>
      <div style={{ display:"flex",gap:10,marginTop:4,width:"100%",maxWidth:360 }}>
        <button className="btn btn-secondary" style={{ flex:1 }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={() => startStream(facing)}>Try Again</button>
      </div>
    </div></div>
  );
  if (camState === "nodevice") return (
    <div className="cam-page"><div className="cam-error">
      <div className="cam-error-icon"><Icon d={ic.camera} size={32} stroke="var(--accent)" /></div>
      <div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>No Camera Found</div>
      <div style={{ fontSize:13,color:"var(--text2)",maxWidth:320,textAlign:"center",lineHeight:1.6 }}>
        No camera was detected on this device. Use the <strong>Upload Photos</strong> button on the Photos tab to add images from your computer.
      </div>
      <button className="btn btn-secondary" onClick={onClose} style={{ marginTop:8 }}>Go Back</button>
    </div></div>
  );
  if (camState === "error") return (
    <div className="cam-page"><div className="cam-error"><div className="cam-error-icon"><Icon d={ic.alert} size={32} stroke="var(--accent)" /></div><div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Camera Unavailable</div><div style={{ fontSize:13,maxWidth:320 }}>No camera found or it is in use by another app.</div><div style={{ display:"flex",gap:10,marginTop:4 }}><button className="btn btn-secondary" onClick={onClose}>Go Back</button><button className="btn btn-primary" onClick={() => startStream(facing)}>Retry</button></div></div></div>
  );

  return (
    <div className="cam-page">
      <canvas ref={canvasRef} style={{ display:"none" }} />

      {/* ââ Photo review overlay ââ */}
      {reviewImg && (
        <div className="review-overlay">
          <img src={reviewImg} alt="preview" />
          <div className="review-meta">
            <div style={{ display:"flex",gap:12,marginBottom:12,alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <div className="form-label">Photo Name</div>
                <input className="form-input" placeholder={`${selRoom} photoâ¦`} value={photoName} onChange={e => setPhotoName(e.target.value)} autoFocus />
              </div>
              <div style={{ minWidth:150 }}>
                <div className="form-label">Room</div>
                <select className="form-input form-select" value={selRoom} onChange={e => setSelRoom(e.target.value)}>
                  {roomList.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {gps && <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:11.5,color:"var(--green)",marginBottom:12 }}><Icon d={ic.mapPin} size={12} stroke="var(--green)" />GPS: {gps.lat}, {gps.lng}</div>}
            <div style={{ display:"flex",gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setReviewImg(null)}>Retake</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={acceptPhoto}><Icon d={ic.check} size={15} /> Accept Photo</button>
            </div>
          </div>
        </div>
      )}

      {/* ââ Video review overlay ââ */}
      {recState === "review" && reviewVideo && (
        <div className="review-overlay">
          <video src={reviewVideo.url} controls autoPlay loop style={{ width:"100%",height:"100%",objectFit:"contain",background:"#000" }} />
          <div className="review-meta">
            <div style={{ display:"flex",gap:12,marginBottom:12,alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <div className="form-label">Video Name</div>
                <input className="form-input" placeholder={`${selRoom} videoâ¦`} value={videoName} onChange={e => setVideoName(e.target.value)} autoFocus />
              </div>
              <div style={{ minWidth:150 }}>
                <div className="form-label">Room</div>
                <select className="form-input form-select" value={selRoom} onChange={e => setSelRoom(e.target.value)}>
                  {roomList.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,.6)",marginBottom:10 }}>
              ð¬ Duration: {fmtTime(recSeconds)} · {gps ? `GPS: ${gps.lat}, ${gps.lng}` : "No GPS"}
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={discardVideo}>Discard</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={acceptVideo}><Icon d={ic.check} size={15} /> Save Video</button>
            </div>
          </div>
        </div>
      )}

      {showApplyAll && session.length > 0 && (
        <div className="review-overlay" style={{ background:"rgba(0,0,0,.86)",justifyContent:"flex-end" }}>
          <div className="review-meta" style={{ maxHeight:"70%",overflowY:"auto" }}>
            <div style={{ fontSize:18,fontWeight:800,color:"white",marginBottom:6 }}>Apply To All</div>
            <div style={{ fontSize:12.5,color:"rgba(255,255,255,.68)",lineHeight:1.55,marginBottom:14 }}>
              Override room, floor, tags, and notes for all {session.length} captured item{session.length !== 1 ? "s" : ""}. GPS and capture timestamps stay with each individual item.
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:10 }}>
              <div>
                <div className="form-label">Room</div>
                <select className="form-input form-select" value={batchRoom} onChange={e => setBatchRoom(e.target.value)}>
                  {roomList.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <div className="form-label">Floor</div>
                <input className="form-input" value={batchFloor} onChange={e => setBatchFloor(e.target.value)} list="camera-floor-options-modal" placeholder="Floor" />
                <datalist id="camera-floor-options-modal">
                  {floorOptions.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>
            </div>
            <div style={{ display:"grid",gap:10,marginBottom:10 }}>
              <div>
                <div className="form-label">Tags</div>
                <input className="form-input" value={batchTagsInput} onChange={e => setBatchTagsInput(e.target.value)} placeholder="Tags, comma separated" />
              </div>
              <div>
                <div className="form-label">Notes</div>
                <textarea className="form-input form-textarea" value={batchNotes} onChange={e => setBatchNotes(e.target.value)} placeholder="Notes to apply to all captured itemsâ¦" style={{ minHeight:88 }} />
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",fontSize:11.5,color:"rgba(255,255,255,.68)",marginBottom:14 }}>
              <span>{batchTags.length > 0 ? `${batchTags.length} shared tag${batchTags.length !== 1 ? "s" : ""} ready` : "No shared tags yet"}</span>
              <span>Per-photo GPS and timestamps will stay unchanged</span>
            </div>
            <div style={{ display:"flex",gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowApplyAll(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={() => finalizeSessionSave(true)}>
                <Icon d={ic.check} size={15} /> Save {session.length} {session.length === 1 ? "Item" : "Items"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cam-view">
        {/* Spinner overlay â shown while starting, sits above the video */}
        {camState === "starting" && (
          <div style={{ position:"absolute",inset:0,zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"#000",color:"var(--text2)",fontSize:14 }}>
            <div style={{ width:46,height:46,borderRadius:"50%",border:"3px solid var(--accent)",borderTopColor:"transparent",animation:"spin .8s linear infinite" }} />
            <span>Starting cameraâ¦</span>
          </div>
        )}
        {/* Video is ALWAYS mounted so videoRef.current is valid when srcObject is assigned */}
        <video ref={videoRef} playsInline muted autoPlay webkit-playsinline="true"
          style={{ width:"100%",height:"100%",objectFit:"cover",display:"block",
            transform:facing==="user"?"scaleX(-1)":"none",
            opacity: camState === "live" ? 1 : 0,
            transition:"opacity .3s" }} />
        <div ref={flashRef} className="cam-flash" />
        {gridOn && camState === "live" && mode === "photo" && (
          <svg className="cam-grid-svg" style={{ opacity:.22 }}>
            <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="1" />
            <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="1" />
            <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="1" />
            <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="1" />
          </svg>
        )}
        <div className="cam-guide"><div className="cam-guide-box"><span /></div></div>
        {countdown !== null && <div className="cam-countdown"><div className="cam-countdown-num">{countdown}</div></div>}

        {/* Rotation lock tip â shows once on mobile, auto-dismisses after 5s */}
        {showRotateTip && camState === "live" && (
          <div style={{ position:"absolute",bottom:100,left:"50%",transform:"translateX(-50%)",zIndex:30,
            background:"rgba(0,0,0,0.78)",borderRadius:14,padding:"10px 18px",
            display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",
            boxShadow:"0 4px 24px rgba(0,0,0,0.4)",backdropFilter:"blur(6px)" }}>
            <span style={{ fontSize:20 }}>ð</span>
            <span style={{ fontSize:13,color:"white",fontWeight:500 }}>Turn off rotation lock for landscape photos</span>
            <button onClick={() => { setShowRotateTip(false); localStorage.setItem("kc_rotate_tip_seen","1"); }}
              style={{ background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:18,cursor:"pointer",padding:"0 0 0 4px",lineHeight:1 }}>×</button>

          </div>
        )}

        {/* Recording indicator + timer bar */}
        {recState === "recording" && (
          <div style={{ position:"absolute",top:0,left:0,right:0,zIndex:12 }}>
            {/* Progress bar */}
            <div style={{ height:3,background:"rgba(255,255,255,.15)" }}>
              <div style={{ height:"100%",background:"#e85a3a",width:`${recPct}%`,transition:"width 1s linear" }} />
            </div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,paddingTop:10 }}>
              <span style={{ width:10,height:10,borderRadius:"50%",background:"#e85a3a",display:"inline-block",boxShadow:"0 0 8px #e85a3a",animation:"recBlink 1s ease-in-out infinite" }} />
              <span style={{ color:"white",fontWeight:700,fontSize:15,letterSpacing:".05em",textShadow:"0 1px 4px rgba(0,0,0,.8)" }}>{fmtTime(recSeconds)}</span>
              <span style={{ color:"rgba(255,255,255,.6)",fontSize:12 }}>/ {fmtTime(MAX_REC)}</span>
              <span style={{ color: MAX_REC - recSeconds <= 30 ? "#e85a3a" : "rgba(255,255,255,.5)", fontSize:11, fontWeight:600 }}>
                ({fmtTime(MAX_REC - recSeconds)} left)
              </span>
            </div>
          </div>
        )}

        <div className="cam-hud-top">
          <button className="btn btn-sm" style={{ background:"rgba(0,0,0,.55)",color:"white",border:"1px solid rgba(255,255,255,.2)" }} onClick={onClose}><Icon d={ic.close} size={14} /> Close</button>
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            {project && <div className="pill"><Icon d={ic.briefcase} size={11} />{project.title}</div>}
            <div className="pill"><Icon d={ic.mapPin} size={11} stroke={gps ? "#3dba7e" : "#8b9ab8"} />{gpsLabel}</div>
            <div className="pill" style={{ cursor:"pointer" }} onClick={() => setRoomMenuOpen(o => !o)}>
              <RoomIcon name={selRoom} size={12} stroke="white" /> {selRoom} â¾
            </div>
          </div>
        </div>

        {roomMenuOpen && (
          <div style={{ position:"absolute",top:60,right:14,background:"rgba(13,15,20,.97)",border:"1px solid var(--border)",borderRadius:12,padding:"6px 0",zIndex:15,minWidth:170,maxHeight:300,overflowY:"auto" }}>
            {roomList.map(r => (
              <div key={r} onClick={() => { setSelRoom(r); setRoomMenuOpen(false); }}
                style={{ padding:"8px 16px",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:8,background:selRoom===r?"var(--accent-glow)":"transparent",color:selRoom===r?"var(--accent)":"var(--text)" }}>
                <RoomIcon name={r} size={13} stroke={selRoom===r?"var(--accent)":"var(--text2)"} /> {r}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cam-hud-bot">
        {/* Session thumbnails */}
        {session.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div className="cam-thumb-row">
              {session.map((s,i) => (
                <div key={i} style={{ position:"relative",flexShrink:0 }}>
                  {s.isVideo
                    ? <div className="cam-thumb" style={{ background:"#111",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:3 }}>
                        <span style={{ fontSize:18 }}>ð¬</span>
                        <span style={{ fontSize:9,color:"rgba(255,255,255,.7)" }}>{fmtTime(s.duration||0)}</span>
                      </div>
                    : <img className="cam-thumb" src={s.dataUrl} alt={s.name} title={s.name} />
                  }
                </div>
              ))}
            </div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.55)" }}>
              {session.filter(s=>!s.isVideo).length} photo{session.filter(s=>!s.isVideo).length!==1?"s":""}
              {session.filter(s=>s.isVideo).length > 0 && ` · ${session.filter(s=>s.isVideo).length} video${session.filter(s=>s.isVideo).length!==1?"s":""}`} captured
            </div>
          </div>
        )}

        {/* Mode toggle â Photo / Video */}
        <div style={{ display:"flex",justifyContent:"center",marginBottom:14 }}>
          <div style={{ display:"flex",background:"rgba(0,0,0,.5)",borderRadius:20,padding:3,border:"1px solid rgba(255,255,255,.15)" }}>
            {[{v:"photo",label:"ð· Photo"},{v:"video",label:"ð¬ Video"}].map(({v,label})=>(
              <button key={v} disabled={recState==="recording"}
                onClick={()=>{ if(recState!=="recording") setMode(v); }}
                style={{ padding:"6px 18px",borderRadius:16,fontSize:12.5,fontWeight:700,border:"none",cursor:recState==="recording"?"not-allowed":"pointer",background:mode===v?"white":"transparent",color:mode===v?"#111":"rgba(255,255,255,.7)",transition:"all .15s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Save session button â own row so it's never clipped on mobile */}
        {session.length > 0 && (
          <div style={{ display:"flex",justifyContent:"center",gap:10,marginBottom:10,flexWrap:"wrap" }}>
            <button className="btn btn-secondary" style={{ minWidth:180,justifyContent:"center" }} onClick={() => setShowApplyAll(true)}>
              <Icon d={ic.edit} size={15} /> Apply To All
            </button>
            <button className="btn btn-primary" style={{ minWidth:180,justifyContent:"center" }} onClick={() => finalizeSessionSave(false)}>
              <Icon d={ic.check} size={15} /> Save {session.length} {session.length === 1 ? "Item" : "Items"}
            </button>
          </div>
        )}

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
          {/* Left controls */}
          <div style={{ display:"flex",gap:10,alignItems:"center",minWidth:0 }}>
            {mode === "photo" && (
              <>
                <div className="cam-icon-btn" title="Self-timer" onClick={cycleTimer}>
                  {timerSec > 0 ? <span style={{ fontWeight:700,fontSize:13 }}>{timerSec}s</span> : <Icon d={ic.timer} size={18} />}
                </div>
                <div className={`cam-icon-btn ${gridOn?"lit":""}`} title="Grid" onClick={() => setGridOn(g => !g)}><Icon d={ic.grid} size={18} /></div>
              </>
            )}
            {mode === "video" && recState === "idle" && (
              <div style={{ fontSize:11.5,color:"rgba(255,255,255,.5)",lineHeight:1.4,maxWidth:90,textAlign:"center" }}>Up to<br/>90 sec</div>
            )}
            {mode === "video" && recState === "recording" && (
              <div style={{ fontSize:12,color:"#e85a3a",fontWeight:700 }}>{fmtTime(MAX_REC - recSeconds)} left</div>
            )}
          </div>

          {/* Shutter / Record button */}
          {mode === "photo"
            ? <div className="shutter-outer" onClick={handleShutter}><div className={`shutter-inner ${firing?"firing":""}`} /></div>
            : <div onClick={handleVideoShutter} style={{ cursor:"pointer",position:"relative",width:72,height:72,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:`3px solid ${recState==="recording"?"#e85a3a":"white"}`,transition:"border-color .2s" }} />
                <div style={{ width:recState==="recording"?28:54,height:recState==="recording"?28:54,borderRadius:recState==="recording"?6:"50%",background:recState==="recording"?"#e85a3a":"white",transition:"all .2s",boxShadow:recState==="recording"?"0 0 16px #e85a3a66":"none" }} />
              </div>
          }

          {/* Right controls */}
          <div style={{ display:"flex",flexDirection:"column",gap:10,alignItems:"center",minWidth:0 }}>
            <div style={{ display:"flex",gap:10,alignItems:"center" }}>
              {facing === "environment" && mode === "photo" && (
                <div
                  className="cam-icon-btn"
                  title={flashMode === "on" ? "Flash on â tap to turn off" : "Flash off â tap to turn on"}
                  onClick={toggleTorch}
                  style={flashMode === "on"
                    ? { color:"#ffe066", borderColor:"rgba(255,224,102,.6)", background:"rgba(255,200,0,.25)" }
                    : { color:"rgba(255,255,255,.5)" }}
                >
                  <Icon d={ic.zap} size={18} />
                </div>
              )}
              <div className="cam-icon-btn" title="Flip camera" onClick={flipCam}><Icon d={ic.rotateCw} size={18} /></div>
            </div>
            {mode === "photo" && (
              <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                <span style={{ fontSize:10,color:"rgba(255,255,255,.6)",fontWeight:600 }}>{zoom.toFixed(1)}×</span>
                <input type="range" className="zoom-slider" min="1" max="5" step="0.1" value={zoom} onChange={e => setZoom(+e.target.value)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageEditor({ photo, onClose, onSave }) {
  const canvasRef   = useRef(null);
  const startPos    = useRef(null);
  const lastPos     = useRef(null);
  const snapRef     = useRef(null);
  const textDragRef = useRef(null);

  const [tool,        setTool]        = useState("pen");
  const [color,       setColor]       = useState("#2b7fe8");
  const [bgColor,     setBgColor]     = useState("transparent");
  const [size,        setSize]        = useState(25);
  const [drawing,     setDrawing]     = useState(false);
  const [history,     setHistory]     = useState([]);
  const [future,      setFuture]      = useState([]);
  const [cropRect,    setCropRect]    = useState(null);
  const [textLayers,  setTextLayers]  = useState([]);
  const [activeTextId,       setActiveTextId]       = useState(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [zoom,               setZoom]               = useState(1);
  const [pan,                setPan]                = useState({ x:0, y:0 });
  const panStartRef = useRef(null);
  const cropStartRef  = useRef(null);

  const COLORS = ["#e86c3a","#4a90d9","#3dba7e","#8b7cf8","#e8c53a","#ff6b6b","#fff","#000","#a0b0cc","#f0954e","#3ab8e8","#e85a3a"];

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    if (photo?.dataUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        const MAX_W = 1920, MAX_H = 1080;
        // Fetch the blob to read EXIF orientation (only works for http URLs, not base64)
        let orientation = 1;
        if (photo.dataUrl.startsWith("http")) {
          try {
            const res = await fetch(photo.dataUrl);
            const blob = await res.blob();
            orientation = await getExifOrientation(blob);
          } catch {}
        }
        // Draw to a temp canvas with orientation corrected
        const orientC = document.createElement("canvas");
        drawImageWithOrientation(orientC, img, orientation);
        const scale = Math.min(1, MAX_W / orientC.width, MAX_H / orientC.height);
        c.width  = Math.round(orientC.width  * scale);
        c.height = Math.round(orientC.height * scale);
        ctx.drawImage(orientC, 0, 0, c.width, c.height);
        saveSnap();
      };
      img.src = photo.dataUrl;
    } else {
      ctx.fillStyle = "#1a1e28"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#2a2f42"; ctx.lineWidth = 1;
      for (let x = 0; x < c.width; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,c.height); ctx.stroke(); }
      for (let y = 0; y < c.height; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); }
      ctx.fillStyle = "#3a3f55"; ctx.fillRect(80, 60, 380, 260);
      ctx.fillStyle = "#8b9ab8"; ctx.font = "15px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(photo?.name || "Photo Canvas", 270, 200);
      ctx.fillText("Open the camera to capture real photos", 270, 224);
      saveSnap();
    }
  }, []);

  const saveSnap = () => {
    const c = canvasRef.current;
    if (c) { setHistory(h => [...h.slice(-30), c.toDataURL()]); setFuture([]); }
  };
  const restoreSnap = (dataUrl) => {
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      // Resize canvas to match the snapshot dimensions before drawing
      // This is critical for undo after a crop (canvas shrank, need to grow back)
      c.width  = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };
  const undo = () => {
    if (history.length < 2) return;
    const prev = history[history.length - 2], cur = history[history.length - 1];
    setFuture(f => [cur, ...f]); setHistory(h => h.slice(0, -1)); restoreSnap(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory(h => [...h, next]); setFuture(f => f.slice(1)); restoreSnap(next);
  };

  const pt = e => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx-r.left)*(c.width/r.width), y: (cy-r.top)*(c.height/r.height) };
  };
  const setEditorColor = (nextColor) => {
    setColor(nextColor);
    if (tool === "text" && activeTextId) updateTextLayer(activeTextId, { color: nextColor });
  };
  const updateTextLayer = (id, patch) => setTextLayers(layers => layers.map(layer => layer.id === id ? { ...layer, ...patch } : layer));
  const activeTextLayer = textLayers.find(layer => layer.id === activeTextId) || null;
  const addTextLayer = (point) => {
    const c = canvasRef.current;
    if (!c) return;
    const layer = {
      id: uid(),
      text: "New text",
      x: point?.x ?? c.width / 2,
      y: point?.y ?? c.height / 2,
      fontSize: 42,
      color,
    };
    setTextLayers(layers => [...layers, layer]);
    setActiveTextId(layer.id);
    setTool("text");
  };
  const removeActiveTextLayer = () => {
    if (!activeTextId) return;
    setTextLayers(layers => layers.filter(layer => layer.id !== activeTextId));
    setActiveTextId(null);
  };
  const drawTextLayers = (ctx) => {
    textLayers.forEach(layer => {
      if (!layer.text?.trim()) return;
      ctx.save();
      ctx.font = `700 ${layer.fontSize || 42}px Arial, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillStyle = layer.color || "#2b7fe8";
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 1;
      const lines = String(layer.text).split("\n");
      lines.forEach((line, i) => ctx.fillText(line, layer.x, layer.y + i * (layer.fontSize || 42) * 1.15));
      ctx.restore();
    });
  };
  const renderCompositeDataUrl = (mime = "image/jpeg", quality = 0.95) => {
    const c = canvasRef.current;
    if (!c) return "";
    const tmp = document.createElement("canvas");
    tmp.width = c.width;
    tmp.height = c.height;
    const ctx = tmp.getContext("2d");
    ctx.drawImage(c, 0, 0);
    drawTextLayers(ctx);
    return tmp.toDataURL(mime, quality);
  };
  const getCanvasPointFromEvent = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (c.width / rect.width),
      y: (src.clientY - rect.top) * (c.height / rect.height),
    };
  };
  const beginTextDrag = (layer, e) => {
    if (tool !== "text") return;
    e.preventDefault();
    e.stopPropagation();
    const p = getCanvasPointFromEvent(e);
    textDragRef.current = { id: layer.id, offsetX: p.x - layer.x, offsetY: p.y - layer.y };
    setActiveTextId(layer.id);
  };
  const moveTextDrag = (e) => {
    if (!textDragRef.current) return;
    e.preventDefault();
    const c = canvasRef.current;
    const p = getCanvasPointFromEvent(e);
    const active = textLayers.find(layer => layer.id === textDragRef.current.id);
    if (!active) return;
    const nextX = Math.max(8, Math.min(c.width - 8, p.x - textDragRef.current.offsetX));
    const nextY = Math.max(8, Math.min(c.height - 8, p.y - textDragRef.current.offsetY));
    updateTextLayer(active.id, { x: nextX, y: nextY });
  };
  const endTextDrag = () => {
    textDragRef.current = null;
  };

  const isShape = t => t === "rect" || t === "circle" || t === "arrow" || t === "line";
  const isPreviewTool = t => isShape(t) || t === "blur";

  const drawBlurRect = (ctx, img, from, to) => {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const w = Math.abs(to.x - from.x);
    const h = Math.abs(to.y - from.y);
    if (w < 4 || h < 4) return;
    ctx.save();
    ctx.filter = `blur(${Math.max(6, Math.round(size / 3))}px)`;
    ctx.drawImage(img, x, y, w, h, x, y, w, h);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  };

  const applyCrop = () => {
    if (!cropRect) return;
    const c = canvasRef.current; if (!c) return;
    const { x, y, w, h } = cropRect;
    if (Math.abs(w) < 4 || Math.abs(h) < 4) { setCropRect(null); return; }
    // Save pre-crop state FIRST so undo can restore it (including original canvas dimensions)
    saveSnap();
    const sx = w < 0 ? x + w : x, sy = h < 0 ? y + h : y;
    const sw = Math.abs(w), sh = Math.abs(h);
    const tmp = document.createElement("canvas");
    tmp.width = Math.round(sw); tmp.height = Math.round(sh);
    tmp.getContext("2d").drawImage(c, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
    c.width = tmp.width; c.height = tmp.height;
    c.getContext("2d").drawImage(tmp, 0, 0);
    setCropRect(null);
    // Save post-crop state so redo works
    saveSnap();
  };

  const onDown = e => {
    if (tool === "hand") {
      const src = e.touches ? e.touches[0] : e;
      panStartRef.current = { clientX: src.clientX, clientY: src.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (tool === "text") {
      const p = pt(e);
      addTextLayer(p);
      return;
    }
    if (tool === "crop") {
      const p = pt(e); cropStartRef.current = p;
      setCropRect({ x: p.x, y: p.y, w: 0, h: 0 }); return;
    }
    const p = pt(e);
    setDrawing(true); startPos.current = p; lastPos.current = p;
    if (isPreviewTool(tool)) {
      snapRef.current = canvasRef.current.toDataURL();
    } else {
      const ctx = canvasRef.current.getContext("2d");
      ctx.beginPath(); ctx.arc(p.x, p.y, size/2, 0, Math.PI*2);
      ctx.fillStyle = color; ctx.fill();
    }
  };

  

  const onMove = e => {
    if (tool === "hand" && panStartRef.current) {
      const src = e.touches ? e.touches[0] : e;
      setPan({
        x: panStartRef.current.panX + (src.clientX - panStartRef.current.clientX),
        y: panStartRef.current.panY + (src.clientY - panStartRef.current.clientY),
      });
      return;
    }
    if (tool === "crop" && cropStartRef.current) {
      const p = pt(e);
      setCropRect({ x: cropStartRef.current.x, y: cropStartRef.current.y, w: p.x - cropStartRef.current.x, h: p.y - cropStartRef.current.y });
      return;
    }
    if (!drawing) return;
    const ctx = canvasRef.current.getContext("2d"), p = pt(e);
    if (tool === "pen") {
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      lastPos.current = p;
    } else if (isPreviewTool(tool)) {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current; if (!c) return;
        const cx = c.getContext("2d");
        cx.clearRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0);
        if (tool === "blur") drawBlurRect(cx, img, startPos.current, p);
        else drawShape(cx, tool, startPos.current, p);
      };
      img.src = snapRef.current;
    }
  };

  const onUp = e => {
    if (tool === "hand") { panStartRef.current = null; return; }
    if (tool === "crop") { cropStartRef.current = null; return; }
    if (!drawing) return;
    setDrawing(false);
    if (isPreviewTool(tool)) {
      const p = pt(e), ctx = canvasRef.current.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
        if (tool === "blur") drawBlurRect(ctx, img, startPos.current, p);
        else drawShape(ctx, tool, startPos.current, p);
        saveSnap();
      };
      img.src = snapRef.current;
    } else { saveSnap(); }
  };

  const drawShape = (ctx, type, from, to) => {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    if (type === "rect") {
      ctx.beginPath(); ctx.rect(from.x, from.y, to.x - from.x, to.y - from.y);
      if (bgColor !== "transparent") { ctx.fillStyle = bgColor; ctx.fill(); }
      ctx.stroke();
    } else if (type === "line") {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else if (type === "circle") {
      const rx = Math.abs(to.x - from.x) / 2, ry = Math.abs(to.y - from.y) / 2;
      const cx = from.x + (to.x - from.x) / 2, cy = from.y + (to.y - from.y) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (bgColor !== "transparent") { ctx.fillStyle = bgColor; ctx.fill(); }
      ctx.stroke();
    } else if (type === "arrow") {
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx*dx + dy*dy); if (len < 2) return;
      const angle = Math.atan2(dy, dx);
      const headLen = Math.max(28, size * 4), headAngle = 0.42;
      const shaftEnd = { x: to.x - headLen * 0.6 * Math.cos(angle), y: to.y - headLen * 0.6 * Math.sin(angle) };
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(shaftEnd.x, shaftEnd.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - headLen * Math.cos(angle - headAngle), to.y - headLen * Math.sin(angle - headAngle));
      ctx.lineTo(to.x - headLen * Math.cos(angle + headAngle), to.y - headLen * Math.sin(angle + headAngle));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    }
  };



  const triggerDownload = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.download = filename;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportImg = () => {
    triggerDownload(renderCompositeDataUrl("image/jpeg", 0.95), `${photo?.name || "photo"}.jpg`);
  };
  const downloadPng = () => {
    triggerDownload(renderCompositeDataUrl("image/png"), `${photo?.name || "photo"}_edited.png`);
  };
  const handleDone = () => {
    const c = canvasRef.current;
    if (c && onSave) onSave(renderCompositeDataUrl("image/jpeg", 0.93));
    onClose();
  };

  const tools = [
    { id:"hand",   icon:"M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2 2 2 0 00-2-2 2 2 0 00-2 2v1a2 2 0 00-2-2 2 2 0 00-2 2v6c0 3.31 2.69 6 6 6h2a6 6 0 006-6v-5a2 2 0 00-2-2z", label:"Pan / Move" },
    { id:"pen",    icon:ic.pen,    label:"Draw"   },
    { id:"line",   icon:"M4 20L20 4", label:"Line" },
    { id:"arrow",  icon:"M5 12h14 M12 5l7 7-7 7", label:"Arrow"  },
    { id:"rect",   icon:"M3 3h18v18H3z",           label:"Square" },
    { id:"circle", icon:"M12 22a10 10 0 100-20 10 10 0 000 20z", label:"Circle" },
    { id:"blur",   icon:"M4 7h16 M4 12h16 M4 17h16", label:"Blur Box" },
    { id:"text",   icon:ic.text,   label:"Add Text" },
    { id:"crop",   icon:"M6 2v14a2 2 0 002 2h14 M18 22V8a2 2 0 00-2-2H2", label:"Crop" },
  ];

  const cursor = tool === "hand" ? "grab" : tool === "text" ? "default" : "crosshair";

  return (
    <div className="editor-wrap fade-in">
      {/* ââ Toolbar ââ */}
      <div className="editor-toolbar">
        <button className="btn btn-sm btn-ghost" onClick={onClose}>â Back</button>
        <div className="tool-sep" />
        {tools.map(t => (
          <div key={t.id} className={`tool-btn ${tool===t.id?"active":""}`} title={t.label}
            onClick={() => { setCropRect(null); setTool(t.id); }}>
            <Icon d={t.icon} size={20} />
          </div>
        ))}
        {tool === "crop" && cropRect && Math.abs(cropRect.w) > 4 && Math.abs(cropRect.h) > 4 && (<>
          <div className="tool-sep" />
          <button className="btn btn-sm btn-primary" style={{ fontSize:11.5, padding:"4px 12px" }} onClick={applyCrop}>â Apply Crop</button>
          <button className="btn btn-sm btn-secondary" style={{ fontSize:11.5, padding:"4px 10px" }} onClick={() => setCropRect(null)}>â Cancel</button>
        </>)}
        <div className="tool-sep" />
        <div className="tool-btn editor-undo-desktop" title="Undo" onClick={undo}><Icon d={ic.undo} size={20} /></div>
        <div className="tool-btn editor-undo-desktop" title="Redo" onClick={redo} style={{ transform:"scaleX(-1)" }}><Icon d={ic.undo} size={20} /></div>
        <div style={{ marginLeft:"auto",display:"flex",gap:8 }} className="editor-actions-desktop">
          <button className="btn btn-sm btn-secondary" onClick={exportImg} title="Download as JPEG"><Icon d={ic.download} size={14} /> JPG</button>
          <button className="btn btn-sm btn-secondary" onClick={downloadPng} title="Download as PNG"><Icon d={ic.download} size={14} /> PNG</button>
          <button className="btn btn-sm btn-primary" onClick={handleDone}><Icon d={ic.check} size={14} /> Done</button>
        </div>
      </div>

      {/* ââ Mobile bottom action bar ââ */}
      <div className="editor-actions-mobile" style={{ display:"none",flexDirection:"column",gap:0,background:"var(--surface)",borderTop:"1px solid var(--border)",flexShrink:0 }}>
        {tool === "text" && (
          <div style={{ borderBottom:"1px solid var(--border)" }}>
            <button onClick={() => setMobileControlsOpen(v => !v)}
              style={{ width:"100%",background:"none",border:"none",padding:"9px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",color:"var(--text)",fontSize:13,fontWeight:600,cursor:"pointer" }}>
              <span>âï¸ Text Editor {activeTextLayer ? <span style={{ fontSize:11,color:"var(--accent)",fontWeight:400 }}>â {activeTextLayer.fontSize||42}px</span> : ""}</span>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <button className="btn btn-sm btn-secondary" style={{ padding:"3px 10px",fontSize:12 }} onClick={e => { e.stopPropagation(); addTextLayer(); setMobileControlsOpen(true); }}><Icon d={ic.plus} size={13} /> Add</button>
                <Icon d={mobileControlsOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} size={16} stroke="var(--text3)" />
              </div>
            </button>
            {mobileControlsOpen && (
              <div style={{ padding:"0 16px 12px",display:"flex",flexDirection:"column",gap:10 }}>
                {activeTextLayer ? (
                  <>
                    <textarea
                      value={activeTextLayer.text}
                      onChange={e => updateTextLayer(activeTextLayer.id, { text: e.target.value })}
                      rows={3}
                      placeholder="Type your note"
                      style={{ width:"100%",resize:"none",minHeight:86,borderRadius:12,border:"1px solid var(--border)",background:"var(--panel)",color:"var(--text)",padding:"10px 12px",fontSize:16 }}
                    />
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => updateTextLayer(activeTextLayer.id, { fontSize: Math.max(18, (activeTextLayer.fontSize || 42) - 2) })}>A-</button>
                      <input type="range" min="18" max="120" value={activeTextLayer.fontSize || 42}
                        onChange={e => updateTextLayer(activeTextLayer.id, { fontSize:+e.target.value })}
                        className="size-slider" style={{ flex:1,margin:0 }} />
                      <button className="btn btn-sm btn-secondary" onClick={() => updateTextLayer(activeTextLayer.id, { fontSize: Math.min(120, (activeTextLayer.fontSize || 42) + 2) })}>A+</button>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                      <div style={{ fontSize:12,color:"var(--text2)" }}>{activeTextLayer.fontSize||42}px</div>
                      <button className="btn btn-sm btn-ghost" onClick={removeActiveTextLayer}><Icon d={ic.trash} size={14} /> Delete</button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:12,color:"var(--text2)",lineHeight:1.5 }}>Tap the photo to place a label, then type and resize it here.</div>
                )}
              </div>
            )}
          </div>
        )}
        {/* ââ Collapsible brush/color/zoom controls ââ */}
        <div style={{ borderBottom:"1px solid var(--border)" }}>
          <button
            onClick={() => setMobileControlsOpen(v => !v)}
            style={{ width:"100%",background:"none",border:"none",padding:"9px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",color:"var(--text)",fontSize:13,fontWeight:600,cursor:"pointer" }}>
            <span>ð¨ Brush &amp; Color &nbsp;<span style={{ fontSize:11,color:"var(--text3)",fontWeight:400 }}>{Math.round(zoom*100)}% zoom</span></span>
            <Icon d={mobileControlsOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} size={16} stroke="var(--text3)" />
          </button>
          {mobileControlsOpen && (
            <div style={{ padding:"0 16px 14px",display:"flex",flexDirection:"column",gap:12 }}>
              {/* Zoom */}
              <div>
                <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:6 }}>Zoom â {Math.round(zoom*100)}%</div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <button className="btn btn-sm btn-secondary" style={{ minWidth:36 }} onClick={() => setZoom(z => Math.max(0.25, +(z-0.25).toFixed(2)))}>â</button>
                  <input type="range" min="25" max="300" value={Math.round(zoom*100)} onChange={e => setZoom(+e.target.value/100)} className="size-slider" style={{ flex:1,margin:0 }} />
                  <button className="btn btn-sm btn-secondary" style={{ minWidth:36 }} onClick={() => setZoom(z => Math.min(3, +(z+0.25).toFixed(2)))}>+</button>
                  {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && <button className="btn btn-sm btn-ghost" style={{ fontSize:11 }} onClick={() => { setZoom(1); setPan({x:0,y:0}); }}>Reset</button>}
                </div>
              </div>
              {/* Stroke color */}
              <div>
                <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:6 }}>Stroke Color</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:6 }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setEditorColor(c)}
                      style={{ width:26,height:26,borderRadius:6,background:c,cursor:"pointer",border:`2.5px solid ${color===c?"white":"transparent"}`,boxShadow:color===c?"0 0 0 1.5px var(--accent)":"none",transition:"all .12s" }} />
                  ))}
                  <input type="color" value={color} onChange={e => setEditorColor(e.target.value)}
                    style={{ width:26,height:26,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
                </div>
              </div>
              {/* Background/fill color â hidden for text tool */}
              {tool !== "text" && (
                <div>
                  <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:6 }}>Background / Fill</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:6 }}>
                    <div onClick={() => setBgColor("transparent")}
                      style={{ width:26,height:26,borderRadius:6,cursor:"pointer",border:`2.5px solid ${bgColor==="transparent"?"white":"transparent"}`,boxShadow:bgColor==="transparent"?"0 0 0 1.5px var(--accent)":"none",
                        backgroundImage:"linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%),linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%)",
                        backgroundSize:"8px 8px",backgroundPosition:"0 0,4px 4px" }} />
                    {["rgba(0,0,0,0.5)","rgba(255,255,255,0.5)","#e86c3a","#4a90d9","#3dba7e","#e8c53a","#ff6b6b","#000","#fff","#8b7cf8"].map(c => (
                      <div key={c} onClick={() => setBgColor(c)}
                        style={{ width:26,height:26,borderRadius:6,background:c,cursor:"pointer",border:`2.5px solid ${bgColor===c?"white":"transparent"}`,boxShadow:bgColor===c?"0 0 0 1.5px var(--accent)":"none",transition:"all .12s" }} />
                    ))}
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(bgColor)?bgColor:"#000000"} onChange={e => setBgColor(e.target.value)}
                      style={{ width:26,height:26,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
                  </div>
                </div>
              )}
              {/* Brush size / blur strength */}
              {tool !== "text" && (
                <div>
                  <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--text3)",marginBottom:6 }}>
                    {tool === "blur" ? "Blur Strength" : "Brush Size"} â {size}px
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <button className="btn btn-sm btn-secondary" style={{ minWidth:34 }} onClick={() => setSize(s => Math.max(10, s-5))}>â</button>
                    <input type="range" min="10" max="80" value={size} onChange={e => setSize(+e.target.value)} className="size-slider" style={{ flex:1,margin:0 }} />
                    <button className="btn btn-sm btn-secondary" style={{ minWidth:34 }} onClick={() => setSize(s => Math.min(80, s+5))}>+</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Row 1: Undo / Redo */}
        <div style={{ display:"flex",justifyContent:"center",gap:16,padding:"8px 16px 4px" }}>
          <button className="btn btn-secondary btn-sm" onClick={undo} style={{ flex:1,gap:6 }}><Icon d={ic.undo} size={16}/> Undo</button>
          <button className="btn btn-secondary btn-sm" onClick={redo} style={{ flex:1,gap:6,display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ transform:"scaleX(-1)",display:"inline-flex" }}><Icon d={ic.undo} size={16}/></span> Redo</button>
        </div>
        {/* Row 2: Download JPG, Download PNG, Done */}
        <div style={{ display:"flex",gap:8,padding:"4px 16px 10px" }}>
          <button className="btn btn-secondary btn-sm" onClick={exportImg} style={{ flex:1,gap:5 }}><Icon d={ic.download} size={14}/> JPG</button>
          <button className="btn btn-secondary btn-sm" onClick={downloadPng} style={{ flex:1,gap:5 }}><Icon d={ic.download} size={14}/> PNG</button>
          <button className="btn btn-primary btn-sm" onClick={handleDone} style={{ flex:1,gap:5 }}><Icon d={ic.check} size={14}/> Done</button>
        </div>
      </div>

      {/* ââ Body ââ */}
      <div className="editor-body">
        <div className="canvas-area">
          <div style={{ position:"relative", display:"inline-block", lineHeight:0, transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin:"top center", transition:"transform .1s", cursor: tool === "hand" ? (panStartRef.current ? "grabbing" : "grab") : undefined }} onMouseMove={e => { moveTextDrag(e); onMove(e); }} onMouseUp={e => { endTextDrag(); onUp(e); }} onMouseLeave={e => { endTextDrag(); onUp(e); }} onTouchMove={e => { moveTextDrag(e); onMove(e); }} onTouchEnd={e => { endTextDrag(); onUp(e); }}>
          <canvas ref={canvasRef} width={1280} height={960}
            style={{ borderRadius:8, cursor, border:"1px solid var(--border)", maxWidth:"100%", maxHeight:"100%", display:"block" }}
            onMouseDown={onDown}
            onTouchStart={onDown}
          />
          {canvasRef.current && textLayers.map(layer => {
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = rect.width / canvasRef.current.width;
            const scaleY = rect.height / canvasRef.current.height;
            return (
              <div
                key={layer.id}
                onMouseDown={e => beginTextDrag(layer, e)}
                onTouchStart={e => beginTextDrag(layer, e)}
                style={{
                  position:"absolute",
                  left:layer.x * scaleX,
                  top:layer.y * scaleY,
                  color:layer.color,
                  fontSize:(layer.fontSize || 42) * scaleY,
                  fontWeight:700,
                  lineHeight:1.15,
                  whiteSpace:"pre-wrap",
                  textShadow:"0 1px 6px rgba(0,0,0,.45)",
                  padding:"4px 6px",
                  border:activeTextId===layer.id ? "1.5px dashed rgba(43,127,232,.95)" : "1.5px dashed transparent",
                  borderRadius:8,
                  background:activeTextId===layer.id ? "rgba(255,255,255,.18)" : "transparent",
                  cursor:tool==="text" ? "move" : "default",
                  userSelect:"none",
                  touchAction:"none",
                  maxWidth:rect.width * 0.8,
                }}
              >
                {layer.text || "Text"}
              </div>
            );
          })}

          {/* ââ Crop overlay ââ */}
          {tool === "crop" && cropRect && (() => {
            const c = canvasRef.current;
            if (!c) return null;
            const rect = c.getBoundingClientRect();
            const scaleX = rect.width  / c.width;
            const scaleY = rect.height / c.height;
            const cx = (cropRect.w < 0 ? cropRect.x + cropRect.w : cropRect.x) * scaleX;
            const cy = (cropRect.h < 0 ? cropRect.y + cropRect.h : cropRect.y) * scaleY;
            const cw = Math.abs(cropRect.w) * scaleX;
            const ch = Math.abs(cropRect.h) * scaleY;
            const W = rect.width, H = rect.height;
            return (
              <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
                {/* dark overlay outside crop */}
                <svg width={W} height={H} style={{ position:"absolute", inset:0 }}>
                  <defs>
                    <mask id="crop-mask">
                      <rect width={W} height={H} fill="white" />
                      <rect x={cx} y={cy} width={cw} height={ch} fill="black" />
                    </mask>
                  </defs>
                  <rect width={W} height={H} fill="rgba(0,0,0,0.55)" mask="url(#crop-mask)" />
                  {/* crop border */}
                  <rect x={cx} y={cy} width={cw} height={ch} fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="6 3" />
                  {/* rule-of-thirds grid */}
                  {cw > 20 && ch > 20 && [1,2].map(i => (
                    <g key={i}>
                      <line x1={cx + cw*i/3} y1={cy} x2={cx + cw*i/3} y2={cy+ch} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                      <line x1={cx} y1={cy + ch*i/3} x2={cx+cw} y2={cy + ch*i/3} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                    </g>
                  ))}
                  {/* corner handles */}
                  {[[cx,cy],[cx+cw,cy],[cx,cy+ch],[cx+cw,cy+ch]].map(([hx,hy],i) => (
                    <g key={i}>
                      <rect x={hx-5} y={hy-5} width={10} height={10} fill="white" rx="2" />
                    </g>
                  ))}
                  {/* dimensions label */}
                  {cw > 60 && ch > 30 && (
                    <text x={cx + cw/2} y={cy + ch/2} textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize="12" fontFamily="sans-serif"
                      style={{ textShadow:"0 1px 3px rgba(0,0,0,0.8)" }}>
                      {Math.round(Math.abs(cropRect.w))} × {Math.round(Math.abs(cropRect.h))}
                    </text>
                  )}
                </svg>
              </div>
            );
          })()}

          </div>{/* end canvas inner wrapper */}
        </div>

        {/* ââ Sidebar ââ */}
        <div className="editor-side">
          <h4>Zoom â {Math.round(zoom*100)}%</h4>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:14 }}>
            <button className="btn btn-sm btn-secondary" style={{ minWidth:30 }} onClick={() => setZoom(z => Math.max(0.25, +(z-0.25).toFixed(2)))}>â</button>
            <input type="range" min="25" max="300" value={Math.round(zoom*100)} onChange={e => setZoom(+e.target.value/100)} className="size-slider" style={{ flex:1 }} />
            <button className="btn btn-sm btn-secondary" style={{ minWidth:30 }} onClick={() => setZoom(z => Math.min(3, +(z+0.25).toFixed(2)))}>+</button>
            {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && <button className="btn btn-sm btn-ghost" style={{ fontSize:11,padding:"2px 6px" }} onClick={() => { setZoom(1); setPan({x:0,y:0}); }}>1:1</button>}
          </div>
          <h4>Stroke Color</h4>
          <div className="color-grid">
            {COLORS.map(c => <div key={c} className={`color-dot ${color===c?"sel":""}`} style={{ background:c }}
              onClick={() => setEditorColor(c)} />)}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
            <span style={{ fontSize:11,color:"var(--text2)" }}>Custom</span>
            <input type="color" value={color} onChange={e => setEditorColor(e.target.value)}
              style={{ width:28,height:28,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
          </div>

          {tool === "text" ? (
            <>
              <h4>Add Text</h4>
              <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" }}>
                <button className="btn btn-sm btn-secondary" onClick={() => addTextLayer()}><Icon d={ic.plus} size={14} /> New Text</button>
                {activeTextLayer && (
                  <button className="btn btn-sm btn-ghost" onClick={removeActiveTextLayer}><Icon d={ic.trash} size={14} /> Delete</button>
                )}
              </div>
              <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:10,lineHeight:1.5 }}>
                Tap the photo to drop a text label, type below, then drag the label into place.
              </div>
              {activeTextLayer ? (
                <>
                  <textarea
                    value={activeTextLayer.text}
                    onChange={e => updateTextLayer(activeTextLayer.id, { text: e.target.value })}
                    rows={4}
                    placeholder="Type your note"
                    style={{ width:"100%",resize:"vertical",minHeight:92,borderRadius:12,border:"1px solid var(--border)",background:"var(--panel)",color:"var(--text)",padding:"10px 12px",fontSize:14,marginBottom:12 }}
                  />
                  <h4>Font Size</h4>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => updateTextLayer(activeTextLayer.id, { fontSize: Math.max(18, (activeTextLayer.fontSize || 42) - 2) })}>-</button>
                    <input
                      type="range"
                      min="18"
                      max="120"
                      value={activeTextLayer.fontSize || 42}
                      onChange={e => updateTextLayer(activeTextLayer.id, { fontSize:+e.target.value })}
                      className="size-slider"
                      style={{ flex:1 }}
                    />
                    <button className="btn btn-sm btn-secondary" onClick={() => updateTextLayer(activeTextLayer.id, { fontSize: Math.min(120, (activeTextLayer.fontSize || 42) + 2) })}>+</button>
                  </div>
                  <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:12 }}>
                    <span>{activeTextLayer.fontSize || 42}px</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:12,lineHeight:1.5 }}>
                  Add a text box or tap directly on the photo to place one.
                </div>
              )}
            </>
          ) : (
            <>
              <h4>Background / Fill</h4>
              <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:6 }}>
                <div onClick={() => setBgColor("transparent")}
                  style={{ width:22,height:22,borderRadius:5,cursor:"pointer",border:`2px solid ${bgColor==="transparent"?"white":"transparent"}`,
                    backgroundImage:"linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%),linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%)",
                    backgroundSize:"8px 8px",backgroundPosition:"0 0,4px 4px" }} />
                {["rgba(0,0,0,0.5)","rgba(255,255,255,0.5)","#e86c3a","#4a90d9","#3dba7e","#e8c53a","#ff6b6b","#000","#fff","#8b7cf8","#f0954e","#1a1e28"].map(c => (
                  <div key={c} className={`color-dot ${bgColor===c?"sel":""}`} style={{ background:c }}
                    onClick={() => setBgColor(c)} />
                ))}
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                <span style={{ fontSize:11,color:"var(--text2)" }}>Custom</span>
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(bgColor)?bgColor:"#000000"}
                  onChange={e => setBgColor(e.target.value)}
                  style={{ width:28,height:28,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2,background:"none" }} />
              </div>

              <h4>{tool === "blur" ? "Blur Strength" : "Brush / Line Size"}</h4>
              <input type="range" min="10" max="80" value={size} onChange={e => setSize(+e.target.value)} className="size-slider" />
              <div style={{ fontSize:11.5,color:"var(--text2)",marginBottom:12 }}>
                <span>{size}px</span>
              </div>
            </>
          )}

          {photo?.gps && (<>
            <div className="divider" />
            <h4>GPS</h4>
            <div style={{ fontSize:11,color:"var(--green)",lineHeight:1.8 }}>{photo.gps.lat}<br />{photo.gps.lng}</div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ââ New / Edit Project Modal âââââââââââââââââââââââââââââââââââââââââââââââââââ
