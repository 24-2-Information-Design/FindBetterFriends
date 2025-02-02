import { useEffect, useState } from 'react';
import useChainStore from '../store/store';
import eyeOpenIcon from '../assets/icons/eyeopen.png';
import eyeCloseIcon from '../assets/icons/eyeclose.png';

const ValidatorTable = () => {
    const {
        selectedChain,
        selectedValidators,
        baseValidator,
        setBaseValidator,
        setSelectedValidators,
        hiddenValidators,
    } = useChainStore();
    const [validatorData, setValidatorData] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [sortConfig, setSortConfig] = useState({
        key: 'matchRate',
        direction: 'desc',
    });

    useEffect(() => {
        if (!selectedChain || !selectedValidators.length) {
            setValidatorData([]);
            setSelectedRows([]);
            return;
        }

        fetch(`/data/validator_result/validator_result_${selectedChain}.json`)
            .then((response) => response.json())
            .then((data) => {
                if (selectedValidators.length === 1) {
                    const singleValidator = selectedValidators[0];
                    const validatorInfo = data.find((item) => item.voter === singleValidator);

                    if (validatorInfo) {
                        setValidatorData([
                            {
                                validator: singleValidator,
                                matchRate: 1,
                                cluster: validatorInfo.cluster_label,
                                overallMatchRate: validatorInfo.overall_match_rate || 0,
                                clusterMatchRate: validatorInfo.cluster_match_rate || 0,
                                participationRate: validatorInfo.participation_rate || 0,
                            },
                        ]);
                    }
                    return;
                }

                const currentBaseValidator = baseValidator || selectedValidators[0];
                const baseValidatorData = data.find((item) => item.voter === currentBaseValidator);

                if (!baseValidatorData) {
                    setValidatorData([]);
                    return;
                }

                const validatorsInfo = selectedValidators
                    .filter((validator) => validator !== currentBaseValidator)
                    .map((validator) => {
                        const validatorInfo = data.find((item) => item.voter === validator);
                        const clusterLabel = validatorInfo ? validatorInfo.cluster_label : 'N/A';

                        return {
                            validator,
                            matchRate: baseValidatorData[validator] || 0,
                            cluster: clusterLabel,
                            overallMatchRate: validatorInfo?.overall_match_rate || 0,
                            clusterMatchRate: validatorInfo?.cluster_match_rate || 0,
                            participationRate: validatorInfo?.participation_rate || 0,
                        };
                    });

                const initialData = [
                    {
                        validator: currentBaseValidator,
                        matchRate: 1,
                        cluster: baseValidatorData.cluster_label,
                        overallMatchRate: baseValidatorData.overall_match_rate || 0,
                        clusterMatchRate: baseValidatorData.cluster_match_rate || 0,
                        participationRate: baseValidatorData.participation_rate || 0,
                    },
                    ...validatorsInfo,
                ];

                setValidatorData(initialData);
            })
            .catch((error) => {
                console.error('Error loading validator results:', error);
                setValidatorData([]);
            });
    }, [selectedChain, selectedValidators, baseValidator]);

    const sortValidatorData = (data, key, direction) => {
        return [...data].sort((a, b) => {
            let comparison = 0;

            if (key === 'cluster') {
                const aMatch = String(a[key] || '').match(/\d+/);
                const bMatch = String(b[key] || '').match(/\d+/);
                const aNumber = aMatch ? parseInt(aMatch[0]) : -1;
                const bNumber = bMatch ? parseInt(bMatch[0]) : -1;
                comparison = aNumber - bNumber;
            } else if (key === 'validator') {
                const aValue = String(a[key] || '').toLowerCase();
                const bValue = String(b[key] || '').toLowerCase();
                comparison = aValue.localeCompare(bValue);
            } else {
                comparison = (a[key] || 0) - (b[key] || 0);
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    };

    const handleSort = (key) => {
        if (!selectedChain || !selectedValidators.length) {
            alert('검증인을 선택해주세요');
            return;
        } else {
            const newDirection = sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'desc' : 'asc') : 'desc';

            setSortConfig({ key, direction: newDirection });
            setValidatorData((prevData) => {
                const [first, ...rest] = prevData;
                const sortedRest = sortValidatorData(rest, key, newDirection);
                return [first, ...sortedRest];
            });
        }
    };

    const handleRowSelect = (validator) => {
        setSelectedRows((prev) =>
            prev.includes(validator) ? prev.filter((v) => v !== validator) : [...prev, validator]
        );
    };

    const handleRemoveSelected = () => {
        const remainingValidators = selectedValidators.filter((validator) => !selectedRows.includes(validator));
        setSelectedValidators(remainingValidators);
        setSelectedRows([]);

        if (selectedRows.includes(baseValidator)) {
            setBaseValidator(remainingValidators.length > 0 ? remainingValidators[0] : null);
        }
    };

    const handleSelectAll = () => {
        if (selectedRows.length === validatorData.slice(1).length) {
            setSelectedRows([]);
        } else {
            setSelectedRows(validatorData.slice(1).map((data) => data.validator));
        }
    };
    const handleToggleVisibility = (validator) => {
        useChainStore.getState().toggleHiddenValidator(validator);
    };
    const toggleAllVisibility = () => {
        const { toggleHiddenValidator } = useChainStore.getState();
        const allHidden = validatorData.slice(1).every((data) => hiddenValidators.has(data.validator));

        validatorData.slice(1).forEach((data) => {
            if (allHidden) {
                toggleHiddenValidator(data.validator, false); // 모두 보이게
            } else {
                toggleHiddenValidator(data.validator, true); // 모두 숨기게
            }
        });
    };

    const columns = [
        { key: 'validator', label: 'Validator Name', width: '25%' },
        { key: 'matchRate', label: 'Match Rate(%)', width: '10%' },
        { key: 'cluster', label: 'Cluster', width: '10%' },
        { key: 'overallMatchRate', label: 'Overall Match Rate', width: '15%' },
        { key: 'clusterMatchRate', label: 'Cluster Match Rate', width: '15%' },
        { key: 'participationRate', label: 'Participation Rate', width: '15%' },
    ];

    // 테이블 렌더링 시 숨김 상태에 따라 스타일 적용
    const renderRow = (data, index) => {
        const isHidden = hiddenValidators.has(data.validator);
        return (
            <tr
                key={data.validator}
                className={`border-b hover:bg-blue-200 cursor-pointer ${
                    selectedRows.includes(data.validator) ? 'bg-blue-100' : ''
                } ${isHidden ? 'opacity-50' : ''}`}
                onClick={() => setBaseValidator(data.validator)}
            >
                <td className="p-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleVisibility(data.validator);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                        >
                            <img
                                src={!hiddenValidators.has(data.validator) ? eyeOpenIcon : eyeCloseIcon}
                                alt="visibility"
                                className="w-4 h-4"
                            />
                        </button>
                        <input
                            type="checkbox"
                            checked={selectedRows.includes(data.validator)}
                            onChange={() => handleRowSelect(data.validator)}
                            onClick={(e) => e.stopPropagation()}
                            className="form-checkbox"
                        />
                    </div>
                </td>
                <td className="p-2">{index}</td>
                <td className="p-2">{data.validator}</td>
                <td className="p-2 text-center">{(data.matchRate * 100).toFixed(2)}</td>
                <td className="p-2 text-center">{data.cluster}</td>
                <td className="p-2 text-center">{(data.overallMatchRate * 100).toFixed(2)}</td>
                <td className="p-2 text-center">{(data.clusterMatchRate * 100).toFixed(2)}</td>
                <td className="p-2 text-center">{(data.participationRate * 100).toFixed(2)}</td>
            </tr>
        );
    };

    return (
        <div className="">
            <div className="flex justify-between items-center p-3 pt-1">
                <p className="font-semibold">Validator Results</p>
                {selectedRows.length > 0 && (
                    <button
                        onClick={handleRemoveSelected}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                    >
                        Remove ({selectedRows.length})
                    </button>
                )}
            </div>

            <div className="pl-3 relative">
                <div style={{ maxHeight: 'calc(2rem * 9)' }} className="overflow-auto">
                    <table
                        className="w-full"
                        style={{ minWidth: '800px', borderCollapse: 'separate', borderSpacing: 0 }}
                    >
                        <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b font-semibold text-xs">
                                <th className="p-1 border-r whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <button onClick={toggleAllVisibility} className="p-1 hover:bg-gray-100 rounded">
                                            <img
                                                src={
                                                    validatorData
                                                        .slice(1)
                                                        .every((data) => hiddenValidators.has(data.validator))
                                                        ? eyeCloseIcon
                                                        : eyeOpenIcon
                                                }
                                                alt="Toggle visibility"
                                                className="w-4 h-4"
                                            />
                                        </button>
                                        <input
                                            type="checkbox"
                                            checked={
                                                validatorData.slice(1).length > 0 &&
                                                selectedRows.length === validatorData.slice(1).length
                                            }
                                            onChange={handleSelectAll}
                                            className="form-checkbox"
                                        />
                                    </div>
                                </th>
                                <th className="p-1 border-r whitespace-nowrap">No.</th>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className="p-2 whitespace-nowrap cursor-pointer hover:bg-gray-100 text-center"
                                        onClick={() => handleSort(column.key)}
                                    >
                                        {column.label}{' '}
                                        {sortConfig.key === column.key
                                            ? sortConfig.direction === 'asc'
                                                ? '▲'
                                                : '▼'
                                            : '↕'}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {validatorData.length > 0 && renderRow(validatorData[0], 1)}
                            {validatorData.slice(1).map((data, index) => renderRow(data, index + 2))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ValidatorTable;
