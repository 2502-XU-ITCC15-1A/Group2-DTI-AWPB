import { supabase } from '../lib/supabase';

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
          units (name),
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

      // For each entry, fetch its monthly targets
      const entriesWithBreakdown = await Promise.all(
        (data || []).map(async (row) => {
          // Fetch monthly targets for this entry
          const { data: monthlyTargets } = await supabase
            .from('monthly_targets')
            .select('month, target_quantity')
            .eq('entry_id', row.id);

          // returns an array of JSONs
          const monthlyBreakdown = MONTHS_LIST.map(month => {
            const targetRecord = (monthlyTargets || []).find(mt => mt.month.toLowerCase() === month);
            const amount = targetRecord ? (targetRecord.target_quantity) * (row.unit_cost || 0) : 0;

            return {
                month: this.getMonthName(month),
                amount: amount
            }
          })

          const flattenedBreakdown = {}
          for (const item of monthlyBreakdown) {
            flattenedBreakdown[item.month] = item.amount;
          }

          // Calculate grand total from monthly breakdown
          const grandTotal = monthlyBreakdown.reduce((sum, m) => sum + (m.amount || 0), 0);

          return {
            unit: row.units?.name || '', 
            component: row.components?.name || '',
            subComponent: row.sub_components?.name || '', 
            keyActivity: row.key_activities?.name || '', 
            no: row.key_activities?.activity_no || '', 
            subActivity: row.sub_activities?.name || '', 
            titleOfActivities: row.title_of_activities, 
            monthlyBreakdown: flattenedBreakdown,
            grandTotal: grandTotal,
          };
        })
      );

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
    const months = {
      'jan': 'January',
      'feb': 'February',
      'mar': 'March',
      'apr': 'April',
      'may': 'May',
      'jun': 'June',
      'jul': 'July',
      'aug': 'August',
      'sep': 'September',
      'oct': 'October',
      'nov': 'November',
      'dec': 'December'
    };
    return months[monthCode?.toLowerCase()] || monthCode;
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
      'Sub Activity': entry.subActivity,
      'Title of Activities': entry.titleOfActivities,
      // Monthly breakdown as JSON string for CSV compatibility
      ...entry.monthlyBreakdown,
      'Grand Total': entry.grandTotal,
    }));
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