import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { HiOutlineCamera, HiOutlineSparkles, HiOutlineUserPlus } from 'react-icons/hi2';
import styles from './Faceid.module.scss';

type Step = 'idle' | 'live' | 'captured';

interface FaceidProps {
  onAuthenticated?: (user: {
    id?: string;
    name: string;
    nickname?: string;
    photoUrl?: string;
  }) => void;
}

const Faceid = ({ onAuthenticated }: FaceidProps) => {
  const webcamRef = useRef<Webcam>(null);
  const [step, setStep] = useState<Step>('idle');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stream.getTracks().forEach((track) => track.stop());
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((item) => item.kind === 'videoinput');
        setDevices(videoDevices);
        if (!selectedDeviceId && videoDevices[0]?.deviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch {
        setDevices([]);
      }
    };

    void loadDevices();
  }, [selectedDeviceId]);

  const openCamera = () => setStep('live');

  const capture = () => {
    const image = webcamRef.current?.getScreenshot();
    if (!image) return;
    setPhoto(image);
    setStep('captured');
  };

  const reset = () => {
    setPhoto(null);
    setStep('idle');
  };

  const submit = () => {
    if (!name.trim()) {
      alert('Ishtirokchi ismini kiriting.');
      return;
    }

    onAuthenticated?.({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      photoUrl: photo || undefined,
    });

    setName('');
    setNickname('');
    setPhoto(null);
    setStep('idle');
  };

  return (
    <section className={styles.registerCard}>
      <div className={styles.header}>
        <div>
          <span className={styles.badge}>Player setup</span>
          <h3>Yangi ishtirokchini qo‘shish</h3>
          <p>Ism kiriting, xohlasangiz surat oling va sessiyaga qo‘shing.</p>
        </div>
        <div className={styles.iconWrap}>
          <HiOutlineSparkles />
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.formArea}>
          <label>
            <span>Ism</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan, Azizbek" />
          </label>

          <label>
            <span>Nickname</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Masalan, Sniper-01"
            />
          </label>

          <label>
            <span>Kamera manbai</span>
            <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}>
              <option value="">Standart kamera</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Kamera ${device.deviceId.slice(0, 4)}`}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={openCamera}>
              <HiOutlineCamera />
              Surat olish
            </button>
            <button type="button" className={styles.primaryButton} onClick={submit}>
              <HiOutlineUserPlus />
              Ishtirokchini qo‘shish
            </button>
          </div>
        </div>

        <div className={styles.previewArea}>
          {step === 'live' ? (
            <>
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : undefined}
                className={styles.cameraView}
              />
              <div className={styles.previewActions}>
                <button type="button" className={styles.primaryButton} onClick={capture}>
                  Kadrni saqlash
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setStep('idle')}>
                  Bekor qilish
                </button>
              </div>
            </>
          ) : photo ? (
            <>
              <img src={photo} alt="Ishtirokchi preview" className={styles.previewImage} />
              <div className={styles.previewActions}>
                <button type="button" className={styles.secondaryButton} onClick={reset}>
                  Qayta olish
                </button>
              </div>
            </>
          ) : (
            <div className={styles.placeholder}>
              <HiOutlineCamera />
              <span>Surat ixtiyoriy. Istasangiz ishtirokchi kartasi uchun kadr oling.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Faceid;
