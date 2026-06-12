import { useSelector } from 'react-redux';
import type { RootState } from '../store';
export const useAppSelector = <T>(selector: (s: RootState) => T) => useSelector(selector);
