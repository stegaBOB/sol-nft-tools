import { GithubIcon, HeartIcon, TwitterIcon } from "./icons";

export function MadeWithLove() {
  return (
    <>
      <a
        target="_blank"
        rel="noopener noreferrer"
        href="https://github.com/penta-fun/sol-nft-tools/"
      >
        <i>
          <GithubIcon />
        </i>
      </a>
      <div className="flex flex-col justify-center items-center text-center">
        <span>
          Made with{" "}
          <i className="inline ml-1">
            <HeartIcon width={16} height={16} />
          </i>
        </span>
        <a
          href="https://twitter.com/@0xAlice_"
          target="_blank"
          rel="noopener noreferrer"
        >
          by 0xAlice
        </a>
      </div>
      <a
        target="_blank"
        rel="noopener noreferrer"
        href="https://twitter.com/@0xAlice_"
      >
        <i>
          <TwitterIcon />
        </i>
      </a>
    </>
  );
}
