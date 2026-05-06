import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import styles from "./SelectRegionBranch.module.scss";
import API from "@/services/api";
import { BsChevronDown } from "react-icons/bs";

interface Region {
  Id: number;
  Name: string;
  Description?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

interface Branch {
  Id: number;
  Name: string;
  RegionId: number;
  Description?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

const SelectRegionBranch = () => {
  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const {
    data: regions,
    isLoading: isLoadingRegions,
    isError: isErrorRegions,
  } = useQuery<Region[]>({
    queryKey: ["regions"],
    queryFn: () => API.getRegions({ skip: 0, limit: 100 }),
  });

  const {
    data: branches,
    isLoading: isLoadingBranches,
    isError: isErrorBranches,
  } = useQuery<Branch[]>({
    queryKey: ["branches", selectedRegion?.Id],
    queryFn: () => API.getBranches({ skip: 0, limit: 100 }),
    enabled: !!selectedRegion,
    select: (all) => all.filter((b) => b.RegionId === selectedRegion?.Id),
  });

  const handleSelectRegion = (region: Region) => {
    setSelectedRegion(region);
    setSelectedBranch(null);
    setIsRegionOpen(false);
  };

  const handleSelectBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsBranchOpen(false);
  };

  if (isLoadingRegions) return <div className={styles.regionbranch}>Hududlar yuklanmoqda...</div>;
  if (isErrorRegions) return <div className={styles.regionbranch}>Hududlarni yuklab bo'lmadi</div>;

  return (
    <div className={styles.regionbranch}>
      <div className={styles.inlineSelects}>
        <div className={styles.dropdown} onClick={() => setIsRegionOpen((p) => !p)}>
          <div className={styles.selected}>
            {selectedRegion ? selectedRegion.Name : "Hududni tanlang"}
            <BsChevronDown size={18} className={`${styles.icon} ${isRegionOpen ? styles.rotate : ""}`} />
          </div>
          {isRegionOpen && (
            <ul className={styles.list}>
              {regions?.map((region) => (
                <li
                  key={region.Id}
                  onClick={() => handleSelectRegion(region)}
                  className={`${styles.item} ${selectedRegion?.Id === region.Id ? styles.active : ""}`}
                >
                  {region.Name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedRegion && (
          <div className={styles.dropdown} onClick={() => setIsBranchOpen((p) => !p)}>
            <div className={styles.selected}>
              {selectedBranch
                ? selectedBranch.Name
                : isLoadingBranches
                ? "Yuklanmoqda..."
                : "Maydonni tanlang"}
              <BsChevronDown size={18} className={`${styles.icon} ${isBranchOpen ? styles.rotate : ""}`} />
            </div>
            {isBranchOpen && branches && (
              <ul className={styles.list}>
                {branches.length > 0 ? (
                  branches.map((branch) => (
                    <li
                      key={branch.Id}
                      onClick={() => handleSelectBranch(branch)}
                      className={`${styles.item} ${selectedBranch?.Id === branch.Id ? styles.active : ""}`}
                    >
                      {branch.Name}
                    </li>
                  ))
                ) : (
                  <li className={styles.empty}>Maydonlar topilmadi</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {selectedBranch && (
        <div className={styles.selectedInfo}>
          <strong>{selectedRegion?.Name}</strong> → <strong>{selectedBranch?.Name}</strong>
        </div>
      )}
    </div>
  );
};

export default SelectRegionBranch;
