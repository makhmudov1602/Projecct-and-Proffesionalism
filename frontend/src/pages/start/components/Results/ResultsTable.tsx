import { Button, Table } from 'antd';
import { Image as AntImage } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HiOutlineDocumentArrowDown, HiOutlineTrophy } from 'react-icons/hi2';
import type { ArenaPlayer, ArenaSessionSummary } from '@/services/api';
import DejaVuTTF from '../../../../assets/fonts/DejaVuSans.ttf?url';
import styles from './ResultsTable.module.scss';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const ensureUnicodeFont = async (doc: jsPDF) => {
  try {
    const res = await fetch(DejaVuTTF);
    const buf = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    doc.addFileToVFS('DejaVuSans.ttf', base64);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.setFont('DejaVuSans', 'normal');
    return true;
  } catch {
    return false;
  }
};

export default function ResultsTable({
  session,
  results,
}: {
  session: ArenaSessionSummary | null;
  results: ArenaPlayer[];
}) {
  const handleDownloadPDF = async () => {
    if (!session) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const ok = await ensureUnicodeFont(doc);
    if (ok) doc.setFont('DejaVuSans', 'normal');

    doc.setFillColor(17, 24, 39);
    doc.roundedRect(24, 24, 547, 70, 18, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('NISHON ARENA — SESSION RESULTS', 40, 53);
    doc.setFontSize(10);
    doc.text(`${session.title} • ${session.mode === 'archery' ? 'Archery' : 'Rifle'} • ${session.max_shots} ta otish`, 40, 73);
    doc.setTextColor(0, 0, 0);

    const body = results.map((row) => [
      String(row.rank ?? '-'),
      row.name,
      row.nickname || '-',
      String(row.camera_id ?? '-'),
      row.shots.join(', ') || '-',
      String(row.total_score),
      String(row.average_score),
    ]);

    autoTable(doc, {
      startY: 116,
      head: [['#', 'Ishtirokchi', 'Nickname', 'Kamera', 'Otishlar', 'Jami ball', 'O‘rtacha']],
      body,
      margin: { left: 24, right: 24 },
      styles: {
        font: ok ? 'DejaVuSans' : undefined,
        fontSize: 9,
        cellPadding: 6,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [239, 246, 255],
        textColor: [15, 23, 42],
      },
    });

    doc.save(`${session.title.replace(/\s+/g, '-').toLowerCase()}-leaderboard.pdf`);
  };

  const columns: ColumnsType<ArenaPlayer> = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 64,
      render: (value) => <span className={styles.rankBadge}>{value}</span>,
    },
    {
      title: 'Avatar',
      dataIndex: 'photo_url',
      key: 'photo_url',
      width: 90,
      render: (src?: string) =>
        src ? <AntImage src={src} alt="avatar" width={48} height={48} style={{ borderRadius: 14, objectFit: 'cover' }} preview={false} /> : <div className={styles.avatarFallback} />,
    },
    {
      title: 'Ishtirokchi',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <div>
          <strong>{row.name}</strong>
          <div className={styles.subtle}>{row.nickname || 'Arena player'}</div>
        </div>
      ),
    },
    {
      title: 'Kamera',
      dataIndex: 'camera_id',
      key: 'camera_id',
      width: 90,
      render: (value?: number | null) => value ?? '-',
    },
    {
      title: 'Otishlar',
      dataIndex: 'shots',
      key: 'shots',
      render: (shots: number[]) => <div className={styles.shotList}>{shots.length ? shots.join(', ') : '-'}</div>,
    },
    {
      title: 'Jami ball',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 110,
    },
    {
      title: 'O‘rtacha',
      dataIndex: 'average_score',
      key: 'average_score',
      width: 110,
    },
  ];

  const winner = results[0];
  const totalShots = results.reduce((sum, item) => sum + item.shots_used, 0);
  const totalScore = results.reduce((sum, item) => sum + item.total_score, 0);

  return (
    <div className={styles.containerResults}>
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span>G‘olib</span>
          <strong>{winner ? winner.name : '-'}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Jami otishlar</span>
          <strong>{totalShots}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Jami ball</span>
          <strong>{totalScore}</strong>
        </div>
        <Button type="primary" size="large" className={styles.downloadButton} onClick={handleDownloadPDF}>
          <HiOutlineDocumentArrowDown />
          PDF export
        </Button>
      </div>

      {winner ? (
        <div className={styles.winnerBanner}>
          <HiOutlineTrophy />
          <div>
            <strong>{winner.name}</strong>
            <span>
              {winner.total_score} ball bilan yetakchi. Eng yaxshi otish: {winner.best_shot}
            </span>
          </div>
        </div>
      ) : null}

      <Table<ArenaPlayer>
        dataSource={results}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 6 }}
        scroll={{ x: 960 }}
      />
    </div>
  );
}
