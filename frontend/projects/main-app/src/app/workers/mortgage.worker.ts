import { buildSchedule, PaymentType } from '../core/mortgage-math';

/**
 * Web Worker: считает помесячный график вне основного потока,
 * чтобы UI не подвисал на длинных сроках. Вся математика — в общем модуле
 * mortgage-math, чтобы формулы не расходились с синхронным fallback в сервисе.
 */
interface Task {
    loan: number;
    months: number;
    rate: number;
    type: PaymentType;
}

addEventListener('message', ({ data }: MessageEvent<Task>) => {
    try {
        const { loan, months, rate, type } = data;

        // Валидация входных параметров
        if (loan <= 0 || months <= 0 || rate <= 0) {
            postMessage([]);
            return;
        }

        postMessage(buildSchedule(loan, months, rate, type));
    } catch (error) {
        console.error('Worker error:', error);
        postMessage([]);
    }
});
