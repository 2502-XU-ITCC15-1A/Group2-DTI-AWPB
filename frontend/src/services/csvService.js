import { supabase } from '../lib/supabase';
import { normalizeUnitCode } from '../lib/units';

// Utility functions for data formatting (reuse from existing components)

const MONTHS_LIST = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec'
]

const MONTH_NAMES = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  may: 'May',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December'
};

// CSV Export Service
export const csvExportService = {
  /**
   * Fetch all approved entries from the database
   * @returns {Promise<Array>} Array of approved entries with full data
   */
  async fetchApprovedEntries() {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select(`
          *,
          profiles!owner_id (username, full_name),
          units (name, code),
          components (name),
          sub_components (name),
          key_activities (name, activity_no, performance_indicator),
          sub_activities (name)
        `)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching approved entries:', error);
        throw error;
      }

      const entryIds = (data || []).map((row) => row.id);
      let targetsByEntryId = {};

      if (entryIds.length > 0) {
        const { data: monthlyTargets, error: targetsError } = await supabase
          .from('monthly_targets')
          .select('entry_id, month, target_quantity')
          .in('entry_id', entryIds);

        if (targetsError) throw targetsError;

        targetsByEntryId = (monthlyTargets || []).reduce((acc, target) => {
          const entryId = target.entry_id;
          if (!acc[entryId]) acc[entryId] = {};
          acc[entryId][String(target.month || '').toLowerCase()] =
            Number(target.target_quantity || 0);
          return acc;
        }, {});
      }

      const entriesWithBreakdown = (data || []).map((row) => {
        const targets = targetsByEntryId[row.id] || {};
        const monthlyBreakdown = MONTHS_LIST.reduce((acc, month) => {
          acc[this.getMonthName(month)] =
            Number(targets[month] || 0) * Number(row.unit_cost || 0);
          return acc;
        }, {});

        const grandTotal = Object.values(monthlyBreakdown).reduce(
          (sum, amount) => sum + Number(amount || 0),
          0,
        );

        return {
          unit: normalizeUnitCode(row.units?.code || row.units?.name || ''),
          component: row.components?.name || '',
          subComponent: row.sub_components?.name || '',
          keyActivity: row.key_activities?.name || '',
          no: row.no || row.activity_no || row.key_activities?.activity_no || '',
          performanceIndicator:
            row.performance_indicator ||
            row.performanceIndicator ||
            row.key_activities?.performance_indicator ||
            '',
          subActivity: row.sub_activities?.name || '',
          titleOfActivities: row.title_of_activities,
          monthlyBreakdown,
          grandTotal,
        };
      });

      return entriesWithBreakdown;
    } catch (error) {
      console.error('Error in fetchApprovedEntries:', error);
      throw error;
    }
  },

  /**
   * Get month name from month code
   * @param {string} monthCode - Three letter month code (jan, feb, etc.)
   * @returns {string} Full month name
   */
  getMonthName(monthCode) {
    return MONTH_NAMES[monthCode?.toLowerCase()] || monthCode;
  },

  /**
   * Transform entry data into CSV-compatible format
   * @param {Array} entries - Array of entry objects
   * @returns {Array} Array of flattened entry objects for CSV
   */
  transformEntriesForCSV(entries) {
    return entries.map(entry => ({
      'Unit': entry.unit,
      'Component': entry.component,
      'Sub Component': entry.subComponent,
      'Key Activity': entry.keyActivity,
      'Activity No.': entry.no,
      'Performance Indicator': entry.performanceIndicator,
      'Sub Activity': entry.subActivity,
      'Title of Activities': entry.titleOfActivities,
      ...entry.monthlyBreakdown,
      'Grand Total': entry.grandTotal,
    }));
  },

  calculateTotalsRow(entries) {
    const monthlyTotals = {};
    let totalGrandTotal = 0;

    entries.forEach(entry => {
      Object.keys(entry.monthlyBreakdown).forEach(month => {
        if (!monthlyTotals[month]) {
          monthlyTotals[month] = 0;
        }
        monthlyTotals[month] += entry.monthlyBreakdown[month];
      });
      totalGrandTotal += entry.grandTotal;
    });

    const totalsRow = {
      'Unit': 'TOTAL',
      'Component': '',
      'Sub Component': '',
      'Key Activity': '',
      'Activity No.': '',
      'Performance Indicator': '',
      'Sub Activity': '',
      'Title of Activities': '',
      ...monthlyTotals,
      'Grand Total': totalGrandTotal,
    };

    return totalsRow;
  },
  /**
   * Convert array of objects to CSV string
   * @param {Array} data - Array of objects to convert
   * @returns {string} CSV formatted string
   */
  convertToCSV(data) {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  },

  /**
   * Generate filename with timestamp
   * @returns {string} Filename for the CSV export
   */
  generateFilename() {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `approved_entries_export_${timestamp}.csv`;
  },

  /**
   * Trigger browser download of CSV file
   * @param {string} csvContent - CSV content as string
   * @param {string} filename - Name of the file to download
   */
  downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  },

  /**
   * Main export function - fetches approved entries and exports to CSV
   * @returns {Promise<{filename: string, recordCount: number}>} Export result info
   */
  async exportApprovedEntriesToCSV() {
    try {
      // Fetch approved entries
      const entries = await this.fetchApprovedEntries();

      if (!entries || entries.length === 0) {
        throw new Error('No approved entries found to export');
      }

      // Transform data for CSV
      const csvData = this.transformEntriesForCSV(entries);

      // Calculate totals row
      const totalsRow = this.calculateTotalsRow(entries);
      csvData.push(totalsRow);

      // Convert to CSV string
      const csvContent = this.convertToCSV(csvData);

      // Generate filename
      const filename = this.generateFilename();

      // Trigger download
      this.downloadCSV(csvContent, filename);

      return {
        filename,
        recordCount: entries.length
      };
    } catch (error) {
      console.error('Error exporting approved entries to CSV:', error);
      throw error;
    }
  }
};
