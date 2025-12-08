import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  TodayStats,
  TrendingItem,
  SlowOPD,
  UrgentIssue,
  RecommendationSummary,
  ReportWithLocation,
} from '@/hooks/use-executive-dashboard';

interface DashboardExportData {
  dateRange?: { from?: Date; to?: Date };
  todayStats: TodayStats;
  trendingByType: TrendingItem[];
  trendingByOPD: TrendingItem[];
  slowOPDs: SlowOPD[];
  urgentIssues: UrgentIssue[];
  recommendations: RecommendationSummary[];
  allReports: ReportWithLocation[];
}

export async function exportDashboardToPDF(data: DashboardExportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Helper function to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (yPos + neededHeight > 280) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Laporan Dashboard Eksekutif', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Date range
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateRangeText = data.dateRange?.from && data.dateRange?.to
    ? `Periode: ${format(data.dateRange.from, 'd MMMM yyyy', { locale: idLocale })} - ${format(data.dateRange.to, 'd MMMM yyyy', { locale: idLocale })}`
    : 'Periode: Semua Data';
  doc.text(dateRangeText, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  // Generated date
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Digenerate pada: ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: idLocale })}`, pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0);
  yPos += 15;

  // Section 1: Summary Statistics
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Ringkasan Statistik', 14, yPos);
  yPos += 8;

  const totalReports = data.allReports.length;
  const pendingReports = data.allReports.filter(r => r.status === 'pending').length;
  const inProgressReports = data.allReports.filter(r => r.status === 'in_progress').length;
  const resolvedReports = data.allReports.filter(r => r.status === 'resolved').length;
  const rejectedReports = data.allReports.filter(r => r.status === 'rejected').length;
  const completionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;

  autoTable(doc, {
    startY: yPos,
    head: [['Metrik', 'Nilai']],
    body: [
      ['Total Laporan', totalReports.toString()],
      ['Pending', pendingReports.toString()],
      ['Dalam Proses', inProgressReports.toString()],
      ['Selesai', resolvedReports.toString()],
      ['Ditolak', rejectedReports.toString()],
      ['Tingkat Penyelesaian', `${completionRate}%`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Section 2: Today's Snapshot
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Snapshot Hari Ini', 14, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [['Metrik', 'Hari Ini', 'Kemarin', 'Perubahan']],
    body: [
      [
        'Laporan Masuk',
        data.todayStats.totalToday.toString(),
        data.todayStats.totalYesterday.toString(),
        (data.todayStats.totalToday - data.todayStats.totalYesterday >= 0 ? '+' : '') +
          (data.todayStats.totalToday - data.todayStats.totalYesterday).toString(),
      ],
      [
        'Pending Baru',
        data.todayStats.pendingToday.toString(),
        data.todayStats.pendingYesterday.toString(),
        (data.todayStats.pendingToday - data.todayStats.pendingYesterday >= 0 ? '+' : '') +
          (data.todayStats.pendingToday - data.todayStats.pendingYesterday).toString(),
      ],
      [
        'Diselesaikan',
        data.todayStats.resolvedToday.toString(),
        data.todayStats.resolvedYesterday.toString(),
        (data.todayStats.resolvedToday - data.todayStats.resolvedYesterday >= 0 ? '+' : '') +
          (data.todayStats.resolvedToday - data.todayStats.resolvedYesterday).toString(),
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Section 3: Urgent Issues
  if (data.urgentIssues.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Isu Mendesak', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Ticket ID', 'Pelapor', 'Deskripsi', 'Tanggal']],
      body: data.urgentIssues.map(issue => [
        issue.ticket_id,
        issue.reporter_name,
        issue.description.substring(0, 50) + '...',
        format(new Date(issue.created_at), 'd MMM yyyy', { locale: idLocale }),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        2: { cellWidth: 60 },
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Section 4: Trending
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Tren Minggu Ini', 14, yPos);
  yPos += 8;

  const trendingData = [...data.trendingByType, ...data.trendingByOPD].filter(t => t.change !== 0);
  if (trendingData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Kategori', 'Minggu Ini', 'Minggu Lalu', 'Perubahan']],
      body: trendingData.map(item => [
        item.name,
        item.thisWeek.toString(),
        item.lastWeek.toString(),
        `${item.change >= 0 ? '+' : ''}${item.change} (${item.changePercent}%)`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Tidak ada perubahan signifikan minggu ini.', 14, yPos);
    yPos += 15;
  }

  // Section 5: Slow OPDs
  if (data.slowOPDs.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. OPD Perlu Perhatian', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['OPD', 'Rata-rata Respons', 'Pending', 'Penyelesaian']],
      body: data.slowOPDs.map(opd => [
        opd.opd_name,
        `${opd.avg_response_hours} jam`,
        opd.pending_count.toString(),
        `${opd.completion_rate}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Section 6: AI Recommendations
  if (data.recommendations.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('6. Rekomendasi AI', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Rekomendasi', 'Frekuensi', 'Jumlah Laporan']],
      body: data.recommendations.slice(0, 10).map(rec => [
        rec.action,
        `${rec.count}x`,
        rec.reports.length.toString(),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [168, 85, 247] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 100 },
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Section 7: Report Type Distribution
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('7. Distribusi Jenis Laporan', 14, yPos);
  yPos += 8;

  const laporCount = data.allReports.filter(r => r.type === 'lapor').length;
  const aspirasiCount = data.allReports.filter(r => r.type === 'aspirasi').length;

  autoTable(doc, {
    startY: yPos,
    head: [['Jenis', 'Jumlah', 'Persentase']],
    body: [
      ['Lapor', laporCount.toString(), `${totalReports > 0 ? Math.round((laporCount / totalReports) * 100) : 0}%`],
      ['Aspirasi', aspirasiCount.toString(), `${totalReports > 0 ? Math.round((aspirasiCount / totalReports) * 100) : 0}%`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Halaman ${i} dari ${pageCount}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
    doc.text(
      'Lapor AI - Sistem Pengaduan Masyarakat',
      14,
      290
    );
  }

  // Save the PDF
  const fileName = `dashboard-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(fileName);
}
