import { Platform } from 'react-native';

interface ImportCost {
  cost_type: string;
  amount: number;
  calculation_type: 'per_unit' | 'per_total';
  description?: string;
}

export interface InventoryImportRecord {
  product_id: string;
  quantity: number;
  base_unit_cost: number;
  final_unit_cost: number;
  total_cost: number;
  business_id: string;
  imported_by: string;
  created_at: string;
  costs: ImportCost[];
}

/**
 * Parses a CSV string containing inventory import data
 * @param csvData The CSV string to parse
 * @returns An array of structured inventory import records
 */
export function parseInventoryImportCsv(csvData: string): InventoryImportRecord[] {
  // Split the CSV into lines
  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  
  // Skip the header line
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    // Split the line by commas, but handle commas within quotes
    const values = line.split(',').map(value => value.trim());
    
    // Extract the main fields
    const product_id = values[0];
    const quantity = parseInt(values[1], 10);
    
    // Handle the three cost entries
    const costs: ImportCost[] = [];
    
    // First cost: Shipping in China
    if (values[2] === 'Shipping in China') {
      const amount = parseFloat(values[3]) || 0;
      const calculation_type = values[4] || 'per_total';
      if (amount > 0) {
        costs.push({
          cost_type: 'Shipping in China',
          amount,
          calculation_type: calculation_type as 'per_unit' | 'per_total'
        });
      }
    }
    
    // Second cost: Card Transaction Fee
    if (values[5] === 'Card Transaction Fee') {
      const amount = parseFloat(values[6]) || 0;
      const calculation_type = values[7] || 'per_total';
      if (amount > 0) {
        costs.push({
          cost_type: 'Card Transaction Fee',
          amount,
          calculation_type: calculation_type as 'per_unit' | 'per_total'
        });
      }
    }
    
    // Third cost: Shipping to Cambodia
    if (values[8] === 'Shipping to Cambodia') {
      const amount = parseFloat(values[9]) || 0;
      const calculation_type = values[10] || 'per_total';
      if (amount > 0) {
        costs.push({
          cost_type: 'Shipping to Cambodia',
          amount,
          calculation_type: calculation_type as 'per_unit' | 'per_total'
        });
      }
    }
    
    // Extract remaining fields
    const base_unit_cost = parseFloat(values[11]) || 0;
    const final_unit_cost = parseFloat(values[12]) || 0;
    const total_cost = parseFloat(values[13]) || 0;
    const business_id = values[14];
    const imported_by = values[15];
    const created_at = values[16];
    
    return {
      product_id,
      quantity,
      base_unit_cost,
      final_unit_cost,
      total_cost,
      business_id,
      imported_by,
      created_at,
      costs
    };
  });
}

/**
 * Parses a CSV file from a File object
 * @param file The File object to parse
 * @returns A Promise that resolves to an array of structured inventory import records
 */
export async function parseInventoryImportFile(file: File): Promise<InventoryImportRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csvData = event.target?.result as string;
        const records = parseInventoryImportCsv(csvData);
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file);
  });
}