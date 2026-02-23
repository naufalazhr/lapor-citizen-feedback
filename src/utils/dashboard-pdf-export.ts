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
import { DashboardAIInsight, getStoredAIInsight } from '@/components/admin/dashboard/executive/AIRecommendationsSummary';
import { maskName, getDefaultMaskingLevel, UserRole } from '@/utils/pii-masking';

interface DashboardExportData {
  dateRange?: { from?: Date; to?: Date };
  todayStats: TodayStats;
  trendingByType: TrendingItem[];
  trendingByOPD: TrendingItem[];
  slowOPDs: SlowOPD[];
  urgentIssues: UrgentIssue[];
  recommendations: RecommendationSummary[];
  allReports: ReportWithLocation[];
  aiInsight?: DashboardAIInsight | null;
  exporterRole?: UserRole;
}

export async function exportDashboardToPDF(data: DashboardExportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;
  let sectionNumber = 1;

  // Get AI insight from localStorage if not provided
  const aiInsight = data.aiInsight ?? getStoredAIInsight();

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

  // Section: AI Executive Summary (if available)
  if (aiInsight) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionNumber}. Ringkasan AI Eksekutif`, 14, yPos);
    sectionNumber++;
    yPos += 8;

    // Executive Summary - using table for proper text wrapping
    autoTable(doc, {
      startY: yPos,
      head: [['Ringkasan Eksekutif']],
      body: [[aiInsight.executive_summary]],
      theme: 'plain',
      headStyles: {
        fillColor: [147, 51, 234], // purple
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 4,
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Priority Alerts - using table
    if (aiInsight.priority_alerts.length > 0) {
      checkPageBreak(40);

      autoTable(doc, {
        startY: yPos,
        head: [['Level', 'Alert', 'Pesan', 'Tindakan']],
        body: aiInsight.priority_alerts.map(alert => [
          alert.level.toUpperCase(),
          alert.title,
          alert.message,
          alert.action,
        ]),
        theme: 'striped',
        headStyles: {
          fillColor: [239, 68, 68], // red
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 20, fontStyle: 'bold' },
          1: { cellWidth: 35 },
          2: { cellWidth: 60 },
          3: { cellWidth: 50 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          // Color code the level column
          if (data.column.index === 0 && data.section === 'body') {
            const level = data.cell.raw?.toString().toLowerCase();
            if (level === 'critical') {
              data.cell.styles.textColor = [239, 68, 68];
            } else if (level === 'warning') {
              data.cell.styles.textColor = [245, 158, 11];
            } else {
              data.cell.styles.textColor = [59, 130, 246];
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Bottlenecks - using table
    if (aiInsight.bottlenecks.length > 0) {
      checkPageBreak(40);

      autoTable(doc, {
        startY: yPos,
        head: [['Area/OPD', 'Masalah', 'Dampak']],
        body: aiInsight.bottlenecks.map(b => [
          b.area,
          b.issue,
          b.impact,
        ]),
        theme: 'striped',
        headStyles: {
          fillColor: [249, 115, 22], // orange
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: 'bold' },
          1: { cellWidth: 60 },
          2: { cellWidth: 60 },
        },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Trends - using table
    if (aiInsight.trends.length > 0) {
      checkPageBreak(40);

      autoTable(doc, {
        startY: yPos,
        head: [['Indikator', 'Arah', 'Interpretasi']],
        body: aiInsight.trends.map(t => {
          const arrow = t.direction === 'up' ? 'Naik' : t.direction === 'down' ? 'Turun' : 'Stabil';
          return [t.indicator, arrow, t.interpretation];
        }),
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246], // blue
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 25 },
          2: { cellWidth: 100 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          // Color code the direction column
          if (data.column.index === 1 && data.section === 'body') {
            const dir = data.cell.raw?.toString();
            if (dir === 'Naik') {
              data.cell.styles.textColor = [239, 68, 68]; // red for up (usually bad)
            } else if (dir === 'Turun') {
              data.cell.styles.textColor = [34, 197, 94]; // green for down (usually good)
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Recommendations Today - using table
    if (aiInsight.recommendations_today.length > 0) {
      checkPageBreak(40);

      autoTable(doc, {
        startY: yPos,
        head: [['No', 'Rekomendasi Hari Ini']],
        body: aiInsight.recommendations_today.map((rec, idx) => [
          (idx + 1).toString(),
          rec,
        ]),
        theme: 'striped',
        headStyles: {
          fillColor: [34, 197, 94], // green
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 150 },
        },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // Section: Summary Statistics
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionNumber}. Ringkasan Statistik`, 14, yPos);
  sectionNumber++;
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

  // Section: Today's Snapshot
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionNumber}. Snapshot Hari Ini`, 14, yPos);
  sectionNumber++;
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

  // Section: Urgent Issues
  if (data.urgentIssues.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionNumber}. Isu Mendesak`, 14, yPos);
    sectionNumber++;
    yPos += 8;

    const exportLevel = getDefaultMaskingLevel(data.exporterRole ?? null);
    autoTable(doc, {
      startY: yPos,
      head: [['Ticket ID', 'Pelapor', 'Deskripsi', 'Tanggal']],
      body: data.urgentIssues.map(issue => [
        issue.ticket_id,
        maskName(issue.reporter_name, exportLevel),
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

  // Section: Trending
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionNumber}. Tren Minggu Ini`, 14, yPos);
  sectionNumber++;
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

  // Section: Slow OPDs
  if (data.slowOPDs.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionNumber}. OPD Perlu Perhatian`, 14, yPos);
    sectionNumber++;
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

  // Section: AI Recommendations (from individual reports)
  if (data.recommendations.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sectionNumber}. Rekomendasi AI (per Laporan)`, 14, yPos);
    sectionNumber++;
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

  // Section: Report Type Distribution
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${sectionNumber}. Distribusi Jenis Laporan`, 14, yPos);
  sectionNumber++;
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
