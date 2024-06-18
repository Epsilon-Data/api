import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AnalysisService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getColumnData(tableName: string, columnName: string): Promise<any[]> {
    return this.databaseService.query(`SELECT ${columnName} FROM ${tableName}`);
  }

  async calculateMean(data: any[], columnName: string): Promise<number> {
    const sum = data.reduce((acc, row) => acc + row[columnName], 0);
    return sum / data.length;
  }

  async calculateVariance(data: any[], columnName: string): Promise<number> {
    const mean = await this.calculateMean(data, columnName);
    const variance =
      data.reduce((acc, row) => acc + Math.pow(row[columnName] - mean, 2), 0) /
      data.length;
    return variance;
  }

  async calculateMedian(data: any[], columnName: string): Promise<number> {
    const values = data.map((row) => row[columnName]).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);

    if (values.length % 2 === 0) {
      return (values[middle - 1] + values[middle]) / 2;
    } else {
      return values[middle];
    }
  }

  async calculateMinimum(data: any[], columnName: string): Promise<number> {
    return Math.min(...data.map((row) => row[columnName]));
  }

  async calculateMaximum(data: any[], columnName: string): Promise<number> {
    return Math.max(...data.map((row) => row[columnName]));
  }

  async calculateStandardDeviation(
    data: any[],
    columnName: string,
  ): Promise<number> {
    const variance = await this.calculateVariance(data, columnName);
    return Math.sqrt(variance);
  }

  async getCalculations(tableName: string, columnName: string): Promise<any> {
    const data = await this.getColumnData(tableName, columnName);
    const mean = await this.calculateMean(data, columnName);
    const variance = await this.calculateVariance(data, columnName);
    const median = await this.calculateMedian(data, columnName);
    const minimum = await this.calculateMinimum(data, columnName);
    const maximum = await this.calculateMaximum(data, columnName);
    const standardDeviation = await this.calculateStandardDeviation(
      data,
      columnName,
    );
    return {
      mean,
      variance,
      median,
      minimum,
      maximum,
      standardDeviation,
    };
  }
}
