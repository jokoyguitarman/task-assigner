import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';

export interface ExportOptions {
  format: 'pdf' | 'jpeg' | 'csv';
  filename?: string;
  title?: string;
}

export interface TaskCompletionReport {
  taskId: string;
  taskName: string;
  assignedTo: string;
  location: string;
  assignedAt: string;
  dueDate: string;
  completedAt?: string;
  status: 'pending' | 'completed' | 'overdue' | 'reschedule_requested';
  proofFiles?: string[];
}

export interface ScheduleExportData {
  month: string;
  year: number;
  staffSchedules: {
    staffName: string;
    position: string;
    outlet: string;
    dailySchedules: {
      date: string;
      timeIn?: string;
      timeOut?: string;
      isDayOff: boolean;
      dayOffType?: string;
      notes?: string;
    }[];
  }[];
}

class ExportService {
  /**
   * Export HTML element to PDF
   */
  async exportToPDF(element: HTMLElement, options: ExportOptions): Promise<void> {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = options.filename || `export_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw new Error('Failed to export to PDF');
    }
  }

  /**
   * Export HTML element to JPEG
   */
  async exportToJPEG(element: HTMLElement, options: ExportOptions): Promise<void> {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = options.filename || `export_${new Date().toISOString().split('T')[0]}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (error) {
      console.error('Error exporting to JPEG:', error);
      throw new Error('Failed to export to JPEG');
    }
  }

  /**
   * Export task completion data to CSV
   */
  exportTaskCompletionToCSV(data: TaskCompletionReport[], options: ExportOptions): void {
    try {
      const csv = Papa.unparse(data, {
        header: true,
        delimiter: ',',
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', options.filename || `task_completion_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error('Failed to export to CSV');
    }
  }

  /**
   * Export task completion data to PDF
   */
  async exportTaskCompletionToPDF(data: TaskCompletionReport[], options: ExportOptions): Promise<void> {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(options.title || 'Task Completion Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Date range
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;

      // Table headers
      const headers = ['Task', 'Assigned To', 'Due Date', 'Status', 'Proof Files'];
      const colWidths = [50, 30, 25, 20, 20];
      const startX = 10;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      
      let xPosition = startX;
      headers.forEach((header, index) => {
        pdf.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += 8;

      // Table data
      pdf.setFont('helvetica', 'normal');
      data.forEach((row, index) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }

        const rowData = [
          row.taskName.substring(0, 30),
          row.assignedTo.substring(0, 20),
          new Date(row.dueDate).toLocaleDateString(),
          row.status,
          row.proofFiles && row.proofFiles.length > 0 ? `${row.proofFiles.length} files` : '-',
        ];

        xPosition = startX;
        rowData.forEach((cell, cellIndex) => {
          pdf.text(cell, xPosition, yPosition);
          xPosition += colWidths[cellIndex];
        });
        yPosition += 6;
      });

      // Summary
      yPosition += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary:', startX, yPosition);
      yPosition += 6;

      const totalTasks = data.length;
      const completedTasks = data.filter(d => d.status === 'completed').length;
      const pendingTasks = data.filter(d => d.status === 'pending').length;
      const overdueTasks = data.filter(d => d.status === 'overdue').length;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`Total Tasks: ${totalTasks}`, startX, yPosition);
      yPosition += 5;
      pdf.text(`Completed: ${completedTasks}`, startX, yPosition);
      yPosition += 5;
      pdf.text(`Pending: ${pendingTasks}`, startX, yPosition);
      yPosition += 5;
      pdf.text(`Overdue: ${overdueTasks}`, startX, yPosition);
      yPosition += 5;
      pdf.text(`Completion Rate: ${totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0}%`, startX, yPosition);

      const filename = options.filename || `task_completion_report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw new Error('Failed to export to PDF');
    }
  }

  /**
   * Export schedule data to PDF
   */
  async exportScheduleToPDF(data: ScheduleExportData, options: ExportOptions): Promise<void> {
    try {
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for schedule
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${data.month} ${data.year} Schedule`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Generate calendar grid
      const daysInMonth = new Date(data.year, new Date(`${data.month} 1, ${data.year}`).getMonth() + 1, 0).getDate();
      const firstDay = new Date(`${data.month} 1, ${data.year}`).getDay();
      
      // Calendar headers
      const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const cellWidth = (pageWidth - 40) / 7;
      const cellHeight = 15;
      const startX = 20;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      
      let xPosition = startX;
      dayHeaders.forEach(day => {
        pdf.text(day, xPosition + cellWidth / 2, yPosition, { align: 'center' });
        xPosition += cellWidth;
      });
      yPosition += cellHeight;

      // Calendar grid
      pdf.setFont('helvetica', 'normal');
      let currentDay = 1;
      
      for (let week = 0; week < 6 && currentDay <= daysInMonth; week++) {
        xPosition = startX;
        
        for (let day = 0; day < 7; day++) {
          if ((week === 0 && day < firstDay) || currentDay > daysInMonth) {
            // Empty cell
            pdf.rect(xPosition, yPosition, cellWidth, cellHeight);
          } else {
            // Day cell
            pdf.rect(xPosition, yPosition, cellWidth, cellHeight);
            pdf.text(currentDay.toString(), xPosition + 2, yPosition + 10);
            
            // Add staff info for this day
            const currentDate = new Date(data.year, new Date(`${data.month} 1, ${data.year}`).getMonth(), currentDay);
            const dateString = currentDate.toISOString().split('T')[0];
            
            let staffY = yPosition + 12;
            data.staffSchedules.forEach(staff => {
              const daySchedule = staff.dailySchedules.find(ds => ds.date === dateString);
              if (daySchedule) {
                if (daySchedule.isDayOff) {
                  pdf.setFontSize(6);
                  pdf.text('OFF', xPosition + 2, staffY);
                } else if (daySchedule.timeIn && daySchedule.timeOut) {
                  pdf.setFontSize(6);
                  pdf.text(`${daySchedule.timeIn}-${daySchedule.timeOut}`, xPosition + 2, staffY);
                }
                staffY += 3;
              }
            });
            
            currentDay++;
          }
          xPosition += cellWidth;
        }
        yPosition += cellHeight;
      }

      // Staff legend
      yPosition += 20;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Staff Schedule Details:', startX, yPosition);
      yPosition += 10;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      data.staffSchedules.forEach(staff => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${staff.staffName} - ${staff.position} (${staff.outlet})`, startX, yPosition);
        yPosition += 6;
        
        pdf.setFont('helvetica', 'normal');
        staff.dailySchedules.forEach(day => {
          const date = new Date(day.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          if (day.isDayOff) {
            pdf.text(`${dayName} ${dateStr}: Day Off (${day.dayOffType || 'General'})`, startX + 10, yPosition);
          } else if (day.timeIn && day.timeOut) {
            pdf.text(`${dayName} ${dateStr}: ${day.timeIn} - ${day.timeOut}`, startX + 10, yPosition);
          }
          yPosition += 4;
        });
        yPosition += 5;
      });

      const filename = options.filename || `schedule_${data.month}_${data.year}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error exporting schedule to PDF:', error);
      throw new Error('Failed to export schedule to PDF');
    }
  }
}

export const exportService = new ExportService();
