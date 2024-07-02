import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AnalysisService {
  constructor(private databaseService: DatabaseService) {}

  setDatabaseService(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  private async getColumnData(
    tableName: string,
    columnName: string,
  ): Promise<any[]> {
    return await this.databaseService.query(
      `SELECT ${columnName} FROM ${tableName}`,
    );
  }

  private async calculateMean(
    data: any[],
    columnName: string,
  ): Promise<number> {
    const sum = data.reduce((acc, row) => acc + row[columnName], 0);
    return sum / data.length;
  }

  private async calculateMedian(
    data: any[],
    columnName: string,
  ): Promise<number> {
    const values = data.map((row) => row[columnName]).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);

    if (values.length % 2 === 0) {
      return (values[middle - 1] + values[middle]) / 2;
    } else {
      return values[middle];
    }
  }

  private async calculateMode(data: any[], columnName: string): Promise<any> {
    const frequency = await this.calculateFrequency(data, columnName);
    const mode = Object.keys(frequency).reduce((a, b) =>
      frequency[a] > frequency[b] ? a : b,
    );
    return mode;
  }

  private async calculateMinimum(
    data: any[],
    columnName: string,
  ): Promise<number> {
    return Math.min(...data.map((row) => row[columnName]));
  }

  private async calculateMaximum(
    data: any[],
    columnName: string,
  ): Promise<number> {
    return Math.max(...data.map((row) => row[columnName]));
  }

  private async calculateStandardDeviation(
    data: any[],
    columnName: string,
  ): Promise<number> {
    const variance = await this.calculateVariance(data, columnName);
    return Math.sqrt(variance);
  }

  private async calculateVariance(
    data: any[],
    columnName: string,
  ): Promise<number> {
    const mean = await this.calculateMean(data, columnName);
    const variance =
      data.reduce((acc, row) => acc + Math.pow(row[columnName] - mean, 2), 0) /
      data.length;
    return variance;
  }

  private async calculateFrequency(
    data: any[],
    columnName: string,
  ): Promise<any> {
    const frequency = data.reduce((acc, row) => {
      const value = row[columnName];
      if (!value || value.length === 0) {
        acc['invalid'] = (acc['invalid'] || 0) + 1;
      } else {
        acc[value] = (acc[value] || 0) + 1;
      }
      return acc;
    }, {});
    if (!frequency['invalid']) {
      frequency['invalid'] = 0;
    }

    // sort in descending order
    const sortedFrequency = Object.keys(frequency)
      .filter((key) => key !== 'invalid')
      .sort((a, b) => frequency[b] - frequency[a])
      .reduce((obj, key) => {
        obj[key] = frequency[key];
        return obj;
      }, {});
    sortedFrequency['invalid'] = frequency['invalid'];
    return sortedFrequency;
  }

  async getOrdinalAnalysis(
    tableName: string,
    columnName: string,
    calculations: string[],
  ): Promise<any> {
    const data = await this.getColumnData(tableName, columnName);

    const result = {};

    calculations.forEach(async (calc) => {
      switch (calc) {
        case 'mean':
          result[calc] = (await this.calculateMean(data, columnName)).toFixed(
            4,
          );
          break;
        case 'median':
          result[calc] = await this.calculateMedian(data, columnName);
          break;
        case 'mode':
          result[calc] = await this.calculateMode(data, columnName);
          break;
        case 'min':
          result[calc] = await this.calculateMinimum(data, columnName);
          break;
        case 'max':
          result[calc] = await this.calculateMaximum(data, columnName);
          break;
        case 'sd':
          result[calc] = (
            await this.calculateStandardDeviation(data, columnName)
          ).toFixed(4);
          break;
        case 'var':
          result[calc] = (
            await this.calculateVariance(data, columnName)
          ).toFixed(4);
          break;
        default:
          console.log(`Unknown calculation: ${calc}`);
      }

      if (
        result.hasOwnProperty(calc) &&
        (result[calc] == undefined || isNaN(result[calc]))
      ) {
        result[calc] = 'N/A';
      }
    });

    return result;
  }

  async getNominalAnalysis(
    tableName: string,
    columnName: string,
  ): Promise<any> {
    const data = await this.getColumnData(tableName, columnName);
    const frequency = await this.calculateFrequency(data, columnName);
    return { frequency: frequency };
  }
}
