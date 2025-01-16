import { useEffect, useState } from 'react';
import NetworkPie from '../components/graph/NetworkPie';
import ScatterPlot from '../components/graph/ScatterPlot';
import useChainStore from '../store/store';
import SunburstChart from '../components/graph/SunburstChart';
import ValidatorTable from '../components/ValidatorTable';
import ClusterResult from '../components/ClusterResult';

const Home = () => {
    const { selectedChain, chainData } = useChainStore();
    const [scatterData, setScatterData] = useState(null);
    const [parallelData, setParallelData] = useState(null);
    const [sunburstData, setSunburstData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedChain) {
            setScatterData(null);
            setParallelData(null);
            setSunburstData(null);
            return;
        }

        setLoading(true);
        setError(null);

        const ScatterFile = `/data/scatter_data/scatter_${selectedChain}.json`;
        const ParallelFile = `/data/parallel_data/parallel_${selectedChain}.json`;
        const SunburstFile = `/data/sunburst_data/sunburst_${selectedChain}.json`;

        Promise.all([
            fetch(ScatterFile).then((response) => response.json()),
            fetch(ParallelFile).then((response) => response.json()),
            fetch(SunburstFile).then((response) => response.json()),
        ])
            .then(([scatterResult, parallelResult, sunburstResult]) => {
                setScatterData(scatterResult);
                setParallelData(parallelResult);
                setSunburstData(sunburstResult);
            })
            .catch((error) => {
                console.log(error);
                setError('Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedChain]);

    return (
        <div className="flex flex-col w-full h-full">
            {/* header */}

            {/* body */}

            <div className="w-full h-full flex ">
                {/* left section */}
                <div className="w-2/5 h-full border-r-2 border-gray-200">
                    <h1 className=" p-3 bg-blue-600 text-white">Find Your Friends</h1>
                    <h2 className="pl-3 pt-2">Overall Chain View</h2>
                    <p className="pl-3 font-semibold">Chain Networks</p>
                    <div className="w-full h-[54.6%]">
                        <NetworkPie />
                    </div>
                    <div className="w-[94%] ml-4 mt-1 mb-1 flex border-t-2 border-gray-200 "></div>

                    {/* chain result */}
                    <div className="w-full h-auto mt-3">
                        <p className="pl-2 ml-2 font-semibold">Chain Results</p>
                        {selectedChain && (
                            <div className=" ml-4 p-1">
                                {/* 상단 3개 */}
                                <div className="grid grid-cols-3 gap-4 text-center font-medium mb-3">
                                    <div className="flex mt-5 mx-auto">
                                        <img
                                            src={`src/assets/chain/${selectedChain}.png`}
                                            alt="selected-chain"
                                            className="w-10 h-10"
                                        />
                                        <strong className="text-xl ml-1 mt-1">{selectedChain}</strong>
                                    </div>
                                    <div className="mt-2">
                                        <img
                                            src="src/assets/result/validator.png"
                                            alt="validators"
                                            className="mx-auto  w-5 h-5 "
                                        />
                                        <strong className="text-sm">{chainData.validator_num}</strong>
                                        <p className="text-xs text-gray-500">Number of Validator</p>
                                    </div>
                                    <div className="mt-2">
                                        <img
                                            src="src/assets/result/proposal.png"
                                            alt="proposals"
                                            className="mx-auto  w-5 h-5"
                                        />
                                        <strong className="text-xs">{chainData.proposal_num}</strong>
                                        <p className="text-xs text-gray-500">Number of Proposal</p>
                                    </div>
                                </div>

                                {/* 하단 3개 */}
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="flex mt-6 justify-center ">
                                            {chainData.similar_chains.map((chain, index) => (
                                                <img
                                                    key={index}
                                                    src={`src/assets/chain/${chain}.png`}
                                                    alt={`similar-chain-${chain}`}
                                                    className=" w-6 h-6 mr-1"
                                                />
                                            ))}
                                        </div>
                                        <strong className="text-xs">{chainData.similar_chains.join(', ')}</strong>
                                        <p className="text-xs text-gray-500">Similar Chain</p>
                                    </div>
                                    <div className="mt-7">
                                        <img
                                            src="src/assets/result/cluster.png"
                                            alt="clusters"
                                            className="mx-auto w-5 h-5"
                                        />
                                        <strong className="text-sm">{chainData.cluster_num}</strong>
                                        <p className="text-xs text-gray-500">Number of Cluster</p>
                                    </div>
                                    <div className="mt-7">
                                        <img
                                            src="src/assets/result/tolerance.png"
                                            alt="tolerance"
                                            className="mx-auto w-5 h-5"
                                        />
                                        <strong className="text-xs">{chainData.radius}</strong>
                                        <p className="text-xs text-gray-500">Tolerance of Opinions</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* right section */}
                <div className="w-3/5 h-full  mr-3">
                    <h2 className="pl-3 pt-2">Specific Validator View</h2>

                    {/* validator & proposal view */}
                    <div className="w-full h-[45%] flex flex-row">
                        <div className="w-1/2 h-full">
                            {scatterData ? (
                                <ScatterPlot data={scatterData} />
                            ) : (
                                selectedChain && <p>Loading scatter plot for {selectedChain}...</p>
                            )}
                        </div>
                        <div className="w-1/2 h-full">
                            <SunburstChart data={sunburstData} parallelData={parallelData} />
                        </div>
                    </div>

                    <div className="w-[95%] ml-5 mt-1 mb-1 flex border-t-2 border-gray-200"></div>

                    {/* parallel view */}
                    <div className="w-full h-[22%]">
                        <p className="pl-3 font-semibold">Votes Tendency</p>
                    </div>

                    <div className="w-[95%] ml-5 mb-1 flex border-t-2 border-gray-200"></div>

                    {/* result view */}
                    <div className="w-full h-[32%] flex flex-row justify-between">
                        <div className="w-[70%] h-full">
                            <ValidatorTable />
                        </div>

                        <div className="h-[80%] ml-2 mt-3 mb-1 flex border-l border-gray-200"></div>

                        <div className="w-[28%] h-full ">
                            <ClusterResult />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
