import { Injectable } from '@nestjs/common';

@Injectable()
export class StandardAnalysisService {
  private calculateMean(data: unknown[], columnName: string) {
    const sum = data.reduce(
      (acc: number, row: Record<string, number>) => acc + row[columnName],
      0,
    ) as number;
    return sum / data.length;
  }

  private calculateMedian(data: unknown[], columnName: string) {
    const values = data
      .map((row: Record<string, number>) => row[columnName])
      .sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);

    if (values.length % 2 === 0) {
      return (values[middle - 1] + values[middle]) / 2;
    } else {
      return values[middle];
    }
  }

  private calculateMode(data: unknown[], columnName: string) {
    const frequency = this.calculateFrequency(data, columnName);
    const mode = Object.keys(frequency).reduce((a, b) =>
      frequency[a] > frequency[b] ? a : b,
    );
    return mode;
  }

  private calculateMinimum(data: unknown[], columnName: string) {
    return Math.min(
      ...data.map((row: Record<string, number>) => row[columnName]),
    );
  }

  private calculateMaximum(data: unknown[], columnName: string) {
    return Math.max(
      ...data.map((row: Record<string, number>) => row[columnName]),
    );
  }

  private calculateStandardDeviation(data: unknown[], columnName: string) {
    const variance = this.calculateVariance(data, columnName);
    return Math.sqrt(variance);
  }

  private calculateVariance(data: unknown[], columnName: string) {
    const mean = this.calculateMean(data, columnName);
    const variance =
      (data.reduce(
        (acc: number, row: Record<string, number>) =>
          acc + Math.pow(row[columnName] - mean, 2),
        0,
      ) as number) / data.length;
    return variance;
  }

  private calculateFrequency(data: unknown[], columnName: string) {
    const frequency = data.reduce(
      (acc: Record<string, number>, row: Record<string, unknown>) => {
        const value = row[columnName] as string;
        if (!value) {
          acc['invalid'] = (acc['invalid'] || 0) + 1;
        } else {
          acc[value] = (acc[value] || 0) + 1;
        }
        return acc;
      },
      {},
    ) as Record<string, number>;
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

  getOrdinalAnalysis(
    tableName: string,
    columnName: string,
    calculations: string[],
  ) {
    const data = []; //await this.getColumnData(tableName, columnName);

    const result = {};

    calculations.forEach((calc) => {
      switch (calc) {
        case 'mean':
          result[calc] = this.calculateMean(data, columnName).toFixed(4);
          break;
        case 'median':
          result[calc] = this.calculateMedian(data, columnName);
          break;
        case 'mode':
          result[calc] = this.calculateMode(data, columnName);
          break;
        case 'min':
          result[calc] = this.calculateMinimum(data, columnName);
          break;
        case 'max':
          result[calc] = this.calculateMaximum(data, columnName);
          break;
        case 'sd':
          result[calc] = this.calculateStandardDeviation(
            data,
            columnName,
          ).toFixed(4);
          break;
        case 'var':
          result[calc] = this.calculateVariance(data, columnName).toFixed(4);
          break;
        default:
          result[calc] = 'N/A';
      }
    });

    return result;
  }

  // async getNominalAnalysis(
  //   tableName: string,
  //   columnName: string,
  // ): Promise<any> {
  //   const data = await this.getColumnData(tableName, columnName);
  //   const frequency = await this.calculateFrequency(data, columnName);
  //   return { frequency: frequency };
  // }
}
