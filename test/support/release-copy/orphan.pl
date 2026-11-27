# Stand-in for the rsync receiver a dropped connection leaves behind. It models what
# macOS openrsync was observed to do (tkx6js, j30n66): it keeps a handle on its
# destination directory, which follows a rename, and when the dead connection finally
# closes it renames its partial file over the real name only with --partial.
# A real orphan is not used here because when it writes depends on rsync's timing.
use strict;
use warnings;

my ($root, @command) = @ARGV;
chdir $command[-1] or die "destination: $!";
$0 = "@command";    # the process list shows what a real receiver shows
my $temp = ".harness.orphan$$";
open my $partial, '>', $temp or die "partial: $!";
print {$partial} 'x' x 50_000;
close $partial or die "partial: $!";
chmod 0600, $temp;
open my $ready, '>', "$root/orphaned" or die "ready: $!";
close $ready;
select undef, undef, undef, 0.1 while -d $root && !-e "$root/close";
if (grep { $_ eq '--partial' } @command) { rename $temp, 'harness' }
else                                     { unlink $temp }
