/**
 * FieldCalculatorTool - 필드 계산기 도구
 * mathjs를 사용하여 속성 필드 계산
 */

import * as math from 'mathjs';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { getArea, getLength } from 'ol/sphere';

class FieldCalculatorTool {
  constructor() {
    // 사용 가능한 함수 목록
    this.functions = [
      { name: 'round(x)', desc: '반올림' },
      { name: 'floor(x)', desc: '내림' },
      { name: 'ceil(x)', desc: '올림' },
      { name: 'abs(x)', desc: '절댓값' },
      { name: 'sqrt(x)', desc: '제곱근' },
      { name: 'pow(x, n)', desc: '거듭제곱' },
      { name: 'log(x)', desc: '자연로그' },
      { name: 'log10(x)', desc: '상용로그' },
      { name: 'sin(x)', desc: '사인' },
      { name: 'cos(x)', desc: '코사인' },
      { name: 'tan(x)', desc: '탄젠트' },
      { name: 'min(a, b, ...)', desc: '최솟값' },
      { name: 'max(a, b, ...)', desc: '최댓값' }
    ];

    // 지오메트리 함수
    this.geoFunctions = [
      { name: '$area', desc: '면적 (㎡)' },
      { name: '$length', desc: '길이 (m)' },
      { name: '$perimeter', desc: '둘레 (m)' }
    ];
  }

  /**
   * 필드 계산 실행
   * @param {string} layerId - 레이어 ID
   * @param {string} fieldName - 결과 필드명
   * @param {string} expression - 계산 표현식
   * @param {boolean} isNewField - 새 필드 생성 여부
   */
  calculate(layerId, fieldName, expression, isNewField = true) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();

    if (features.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    let successCount = 0;
    let errorCount = 0;

    features.forEach((feature, index) => {
      try {
        const value = this.evaluateExpression(expression, feature);
        feature.set(fieldName, value);
        successCount++;
      } catch (error) {
        console.warn(`피처 ${index} 계산 오류:`, error.message);
        errorCount++;
      }
    });

    // 레이어 변경 이벤트 발생
    eventBus.emit(Events.LAYER_CHANGED, { layerId });

    return {
      success: successCount,
      error: errorCount,
      total: features.length
    };
  }

  /**
   * 표현식 평가
   */
  evaluateExpression(expression, feature) {
    let processedExpr = expression;

    // 지오메트리 함수 처리
    const geometry = feature.getGeometry();

    if (processedExpr.includes('$area')) {
      const area = geometry ? getArea(geometry) : 0;
      processedExpr = processedExpr.replace(/\$area/g, area);
    }

    if (processedExpr.includes('$length')) {
      const length = geometry ? getLength(geometry) : 0;
      processedExpr = processedExpr.replace(/\$length/g, length);
    }

    if (processedExpr.includes('$perimeter')) {
      // 폴리곤의 경우 둘레 계산
      let perimeter = 0;
      if (geometry && geometry.getType() === 'Polygon') {
        const coords = geometry.getLinearRing(0).getCoordinates();
        for (let i = 0; i < coords.length - 1; i++) {
          const dx = coords[i + 1][0] - coords[i][0];
          const dy = coords[i + 1][1] - coords[i][1];
          perimeter += Math.sqrt(dx * dx + dy * dy);
        }
      } else if (geometry) {
        perimeter = getLength(geometry);
      }
      processedExpr = processedExpr.replace(/\$perimeter/g, perimeter);
    }

    // 속성 필드 값 치환 (필드명을 []로 감싸서 사용)
    const properties = feature.getProperties();
    const fieldPattern = /\[([^\]]+)\]/g;
    let match;

    while ((match = fieldPattern.exec(expression)) !== null) {
      const fieldName = match[1];
      let fieldValue = properties[fieldName];

      // 숫자가 아니면 0으로 처리
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        fieldValue = 0;
      } else if (typeof fieldValue === 'string') {
        fieldValue = parseFloat(fieldValue) || 0;
      }

      processedExpr = processedExpr.replace(match[0], fieldValue);
    }

    // mathjs로 계산
    try {
      const result = math.evaluate(processedExpr);
      return typeof result === 'number' ? Math.round(result * 1000) / 1000 : result;
    } catch (error) {
      throw new Error(`계산 오류: ${error.message}`);
    }
  }

  /**
   * 레이어의 필드 목록 가져오기
   */
  getLayerFields(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();
    if (features.length === 0) return [];

    const props = features[0].getProperties();
    return Object.keys(props).filter(key => key !== 'geometry');
  }

  /**
   * 사용 가능한 함수 목록
   */
  getFunctions() {
    return this.functions;
  }

  /**
   * 지오메트리 함수 목록
   */
  getGeoFunctions() {
    return this.geoFunctions;
  }
}

export const fieldCalculatorTool = new FieldCalculatorTool();
