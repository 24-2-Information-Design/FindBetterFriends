import { create } from 'zustand';
import chainData from '../data/chain_data.json';
import * as d3 from 'd3';
import linkDataJson from '../data/chain_link_data.json';

// 헬퍼 함수들
const findChainMetadata = (chain) => {
    const metadata = chainData.find((item) => item.chain === chain);
    if (!metadata) return null;

    return {
        radius: metadata.radius,
        validator_num: metadata.validator_num,
        proposal_num: metadata.proposal_num,
        cluster_num: metadata.cluster_num,
        similar_chains: metadata.similar_chains,
        validators: metadata.validators,
    };
};

const findCommonChains = (validators) => {
    return chainData
        .filter((chain) => validators.every((validator) => chain.validators?.includes(validator)))
        .map((chain) => chain.chain);
};

const findValidatorChains = (validators) => {
    return chainData
        .filter((chain) => validators.some((validator) => chain.validators?.includes(validator)))
        .map((chain) => chain.chain);
};

const chainContainsAllValidators = (chain, validators) => {
    const chainData = findChainMetadata(chain);
    return validators.every((validator) => chainData?.validators?.includes(validator));
};

export const useChainStore = create((set, get) => ({
    // 초기 상태
    selectedChain: null,
    chainData: null,
    selectedValidators: [],
    highlightedChains: [],
    highlightedValidators: [],
    baseValidator: null,
    validatorChains: [],
    singleSelectMode: true,

    getChainOpacity: (chainId) => {
        const state = get();
        const { selectedChain, selectedValidators } = state;

        if (!selectedChain) return 1;
        if (chainId === selectedChain) return 1;

        if (selectedValidators.length === 0) {
            const linkData = linkDataJson.find(
                (link) =>
                    (link.chain1 === selectedChain && link.chain2 === chainId) ||
                    (link.chain2 === selectedChain && link.chain1 === chainId)
            );

            if (!linkData) return 0.3;

            const minValidators = d3.min(linkDataJson, (d) => d.shared_validators);
            const maxValidators = d3.max(linkDataJson, (d) => d.shared_validators);

            return 0.3 + ((linkData.shared_validators - minValidators) / (maxValidators - minValidators)) * 0.7;
        }

        const chainData = findChainMetadata(chainId);
        if (!chainData || !chainData.validators) return 0.2;

        const containsAllValidators = selectedValidators.every((validator) => chainData.validators.includes(validator));
        return containsAllValidators ? 0.7 : 0.2;
    },

    // 액션들
    setSelectedChain: (chain) => {
        if (!chain) {
            set({
                selectedChain: null,
                chainData: null,
                validatorChains: [],
            });
            return;
        }

        const currentValidators = get().selectedValidators;
        const currentSingleSelectMode = get().singleSelectMode;
        const metadata = findChainMetadata(chain);
        const containsAllValidators = chainContainsAllValidators(chain, currentValidators);

        if (get().selectedChain === chain) {
            set({
                selectedChain: null,
                chainData: null,
                validatorChains: [],
                selectedValidators: [],
                baseValidator: null,
                highlightedChains: [],
                singleSelectMode: true,
            });
            return;
        }

        set({
            selectedChain: chain,
            chainData: metadata,
            validatorChains: metadata?.validators || [],
            ...(containsAllValidators
                ? {}
                : {
                      // singleSelectMode가 true일 때는 검증인 리스트만 초기화
                      ...(currentSingleSelectMode
                          ? {
                                selectedValidators: [],
                                baseValidator: null,
                            }
                          : {
                                // singleSelectMode가 false일 때는 singleSelectMode와 검증인 선택 상태 유지
                                selectedValidators: [],
                                highlightedValidators: [],
                                baseValidator: null,
                                singleSelectMode: false,
                            }),
                      highlightedChains: [],
                  }),
        });
    },

    setSelectedValidators: (validators) => {
        const commonChains = findCommonChains(validators);
        const validatorChains = findValidatorChains(validators);

        set({
            selectedValidators: validators,
            highlightedChains: commonChains,
            validatorChains,
        });
    },

    setBaseValidator: (validator) => set({ baseValidator: validator }),

    setHighlightedChains: (chains) => set({ highlightedChains: chains }),

    setHighlightedValidators: (validators) => set({ highlightedValidators: validators }),

    setSingleSelectMode: (mode) => {
        const currentValidators = get().selectedValidators;
        const currentBaseValidator = get().baseValidator;

        set({
            singleSelectMode: mode,
            // 단일 선택 모드로 전환시 현재 baseValidator만 유지
            ...(mode && currentBaseValidator // baseValidator가 있을 때만 처리
                ? {
                      selectedValidators: [currentBaseValidator], // baseValidator만 선택된 상태로
                      baseValidator: currentBaseValidator, // baseValidator 유지
                  }
                : mode && currentValidators.length > 0 // baseValidator가 없고 선택된 검증인이 있는 경우
                ? {
                      selectedValidators: [currentValidators[0]], // 첫 번째 선택된 검증인만 유지
                      baseValidator: currentValidators[0], // 첫 번째 선택된 검증인을 baseValidator로
                  }
                : {}), // 그 외의 경우는 변경하지 않음
        });
    },

    resetValidatorSelection: () => {
        const currentSingleSelectMode = get().singleSelectMode;

        set({
            selectedValidators: [],
            highlightedChains: [],
            highlightedValidators: [],
            validatorChains: [],
            baseValidator: null,
            singleSelectMode: currentSingleSelectMode,
        });
    },
}));

export default useChainStore;
