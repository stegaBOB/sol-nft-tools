import { ImageURI } from "../util/image-uri";
import { MenuLink } from "./menu-link";
import { CopyToClipboard } from "../components/copy-to-clipboard";
import { useAlert } from "../contexts/AlertProvider";
import { MadeWithLove } from "./made-with-love";
import {
  BankIcon,
  CameraIcon,
  CoinsIcon,
  FingerPrintIcon,
  FireIcon,
  GetCashIcon,
  HammerIcon,
  InfoIcon,
  SendIcon,
} from "./icons";

export default function SideMenu() {
  const { setAlertState } = useAlert();

  return (
    <div className="drawer-side lg:hidden">
      <label htmlFor="my-drawer" className="drawer-overlay"></label>
      <ul className="flex overflow-y-auto flex-col gap-2 p-4 w-80 border-l border-gray-700 shadow menu bg-base-300 text-base-content">
        <li>
          <a
            href="https://pentacle.xyz"
            target="_blank"
            rel="noreferrer noopener"
            className="py-2 hover:bg-opacity-0 focus:bg-opacity-0"
          >
            <img
              src="/pentacle.svg"
              width={221}
              height={64}
              alt="Pentacle"
            />
          </a>
        </li>
        <MenuLink href="/nft-mints">
          <div>
            <i className="mr-3">
              <FingerPrintIcon />
            </i>
            Get NFT Mints
          </div>
        </MenuLink>
        <MenuLink href="/token-metadata">
          <div
            style={{ width: 14 }}
            className="inline-flex justify-center items-center mr-3"
          >
            <InfoIcon />
          </div>
          Token Metadata
        </MenuLink>
        <MenuLink href="/holder-snapshot">
          <i className="mr-3">
            <CameraIcon width={16} height={16} />
          </i>
          <span> Holder Snapshot</span>
        </MenuLink>
        <MenuLink href="/nft-minters">
          <i className="mr-3">
            <CoinsIcon width={16} height={16} />
          </i>
          <span> NFT Minters</span>
        </MenuLink>
        <MenuLink href="/shadow-drive">
          <img
            src={ImageURI.GenesysGo}
            alt="GenesysGos"
            className="mr-2"
            style={{
              filter: "grayscale(100%)",
              width: 16,
              height: 16,
              display: "inline",
            }}
          />
          Shadow Drive Console
        </MenuLink>
        <MenuLink href="/burn-nfts">
          <i className="mr-3">
            <FireIcon />
          </i>
          <span>Burn NFTs</span>
        </MenuLink>
        <MenuLink href="/mint-nft">
          <i className="mr-3">
            <HammerIcon />
          </i>
          Mint NFT
        </MenuLink>
        <MenuLink href="/send-nfts">
          <i className="mr-3">
            <SendIcon />
          </i>
          Send Multiple NFTs
        </MenuLink>
        {/* <MenuLink href="/find-stuck-sol">Find Stuck SOL</MenuLink> */}
        <MenuLink href="/arweave-upload">
          <i className="mr-3">
            <img
              src="https://shdw-drive.genesysgo.net/FihpNAwDm8i6gBsqeZjV9fn8SkkpYFgcWt5BSszPusnq/arweave.png"
              width={16}
              height={16}
            />
          </i>
          <span>Arweave Upload</span>
        </MenuLink>
        <MenuLink href="/snedmaster">
          <i className="mr-3">
            <GetCashIcon width={16} height={16} />
          </i>
          <span>SnedMaster</span>
        </MenuLink>
        <MenuLink href="/stake">
          <i className="mr-3">
            <BankIcon width={16} height={16} />
          </i>
          <span>Stake View</span>
        </MenuLink>

        <div className="mt-auto w-full">
          <div
            className={`flex flex-col gap-4 justify-center items-center text-center`}
          >
            <MadeWithLove />
          </div>
          <div>
            <div className="text-sm text-center">
              <CopyToClipboard
                text={"lolfees.sol"}
                onCopy={() =>
                  setAlertState({
                    message: "Copied to clipboard!",
                    duration: 2000,
                    open: true,
                  })
                }
              >
                <span className={`ml-1 cursor-pointer`}>
                  Donations: lolfees.sol
                </span>
              </CopyToClipboard>
            </div>
          </div>
        </div>
      </ul>
    </div>
  );
}
